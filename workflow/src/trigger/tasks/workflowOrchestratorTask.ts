import { task, logger } from "@trigger.dev/sdk/v3";
import type { WorkflowTaskPayload } from "../types";
import type {
  WorkflowNode,
  WorkflowEdge,
} from "../../features/workflow-editor/types";
import {
  compileDAG,
  computeExecutionSubgraph,
} from "../../features/workflow-editor/engine/dagCompiler";
import { resolveNodeInputs } from "../../features/workflow-editor/engine/inputResolver";
import type { NodeOutputRegistry } from "../../features/workflow-editor/engine/inputResolver";
import { geminiTask } from "./geminiTask";
import { cropImageTask } from "./cropImageTask";

export const workflowOrchestratorTask = task({
  id: "workflow-orchestrate",
  maxDuration: 600,

  run: async (payload: WorkflowTaskPayload): Promise<void> => {
    const {
      runId,
      workflowId,
      nodes,
      edges,
      scope,
      targetNodeIds,
      callbackBaseUrl,
    } = payload;

    logger.info("Workflow orchestration started", {
      runId,
      workflowId,
      scope,
      nodeCount: nodes.length,
    });

    const { dag, error } = compileDAG(
      nodes as WorkflowNode[],
      edges as WorkflowEdge[],
    );

    if (!dag || error) {
      logger.error("DAG compile failed", { error: error?.message });
      await notify.runStatus(callbackBaseUrl, runId, workflowId, "FAILED");
      return;
    }

    let executionSet: Set<string>;
    if (scope === "FULL") {
      executionSet = new Set((nodes as WorkflowNode[]).map((n) => n.id));
    } else if (targetNodeIds?.length) {
      executionSet = computeExecutionSubgraph(targetNodeIds, dag);
    } else {
      executionSet = new Set((nodes as WorkflowNode[]).map((n) => n.id));
    }

    const executionNodeIds = dag.executionOrder.filter((id) =>
      executionSet.has(id),
    );

    if (executionNodeIds.length === 0) {
      await notify.runStatus(callbackBaseUrl, runId, workflowId, "SUCCESS");
      return;
    }

    // Mark all nodes as queued
    for (const nodeId of executionNodeIds) {
      await notify.nodeStatus(
        callbackBaseUrl,
        runId,
        workflowId,
        nodeId,
        "QUEUED",
        {},
      );
    }

    const outputRegistry: NodeOutputRegistry = new Map();
    const completed = new Set<string>();
    const failed = new Set<string>();
    const skipped = new Set<string>();

    function isReady(nodeId: string): boolean {
      const compiled = dag.nodes.get(nodeId);
      if (!compiled) return false;
      const upstreamInSet = compiled.upstreamIds.filter((id) =>
        executionSet.has(id),
      );
      if (upstreamInSet.some((id) => failed.has(id) || skipped.has(id)))
        return false;
      return upstreamInSet.every((id) => completed.has(id));
    }

    function shouldSkip(nodeId: string): boolean {
      const compiled = dag.nodes.get(nodeId);
      if (!compiled) return false;
      return compiled.upstreamIds
        .filter((id) => executionSet.has(id))
        .some((id) => failed.has(id) || skipped.has(id));
    }

    async function executeOneNode(nodeId: string): Promise<void> {
      const node = (nodes as WorkflowNode[]).find((n) => n.id === nodeId);
      if (!node) return;

      const nodeType = node.type ?? "unknown";
      const compiled = dag.nodes.get(nodeId)!;

      if (shouldSkip(nodeId)) {
        skipped.add(nodeId);
        await notify.nodeStatus(
          callbackBaseUrl,
          runId,
          workflowId,
          nodeId,
          "SKIPPED",
          {},
        );
        return;
      }

      const inputs = resolveNodeInputs(
        nodeId,
        nodes as WorkflowNode[],
        compiled,
        outputRegistry,
      );

      // Request-Inputs and Response run inline (no Trigger.dev task)
      if (nodeType === "request-inputs" || nodeType === "response") {
        await notify.nodeStatus(
          callbackBaseUrl,
          runId,
          workflowId,
          nodeId,
          "RUNNING",
          inputs,
        );
        await new Promise((r) => setTimeout(r, 100));
        const output =
          nodeType === "request-inputs"
            ? { ...inputs }
            : { result: inputs.result ?? null };
        outputRegistry.set(nodeId, output);
        completed.add(nodeId);
        await notify.nodeStatus(
          callbackBaseUrl,
          runId,
          workflowId,
          nodeId,
          "SUCCESS",
          inputs,
          output,
          undefined,
          100,
        );
        return;
      }

      // Gemini and Crop Image → Trigger.dev tasks
      try {
        const taskPayload = {
          runId,
          workflowId,
          nodeId,
          nodeType,
          inputs,
          callbackBaseUrl,
        };
        let result: { output: Record<string, unknown>; durationMs: number };

        if (nodeType === "gemini") {
          const handle = await geminiTask.triggerAndWait(taskPayload);
          if (!handle.ok) throw new Error("Gemini task failed");
          result = handle.output;
        } else if (nodeType === "crop-image") {
          const handle = await cropImageTask.triggerAndWait(taskPayload);
          if (!handle.ok) throw new Error("Crop Image task failed");
          result = handle.output;
        } else {
          skipped.add(nodeId);
          return;
        }

        outputRegistry.set(nodeId, result.output);
        completed.add(nodeId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Task failed";
        logger.error("Node execution failed", { nodeId, nodeType, errorMsg });
        failed.add(nodeId);
        await notify.nodeStatus(
          callbackBaseUrl,
          runId,
          workflowId,
          nodeId,
          "FAILED",
          inputs,
          {},
          errorMsg,
          0,
        );
      }
    }

    const inFlight = new Set<string>();
    const pending = new Set(executionNodeIds);

    async function scheduleReady(): Promise<void> {
      const toStart: string[] = [];
      for (const nodeId of pending) {
        if (inFlight.has(nodeId)) continue;
        if (shouldSkip(nodeId)) {
          pending.delete(nodeId);
          skipped.add(nodeId);
          await notify.nodeStatus(
            callbackBaseUrl,
            runId,
            workflowId,
            nodeId,
            "SKIPPED",
            {},
          );
          continue;
        }
        if (isReady(nodeId)) toStart.push(nodeId);
      }
      if (toStart.length === 0) return;
      await Promise.all(
        toStart.map(async (nodeId) => {
          pending.delete(nodeId);
          inFlight.add(nodeId);
          await executeOneNode(nodeId);
          inFlight.delete(nodeId);
          await scheduleReady();
        }),
      );
    }

    await scheduleReady();

    let finalStatus: "SUCCESS" | "FAILED" | "PARTIAL";
    if (failed.size === 0 && skipped.size === 0) finalStatus = "SUCCESS";
    else if (completed.size === 0) finalStatus = "FAILED";
    else finalStatus = "PARTIAL";

    await notify.runStatus(callbackBaseUrl, runId, workflowId, finalStatus);

    logger.info("Workflow orchestration completed", {
      runId,
      finalStatus,
      completed: completed.size,
      failed: failed.size,
      skipped: skipped.size,
    });
  },
});

// ─── Callback helpers ─────────────────────────────────────────────────────────

const notify = {
  async nodeStatus(
    baseUrl: string,
    runId: string,
    workflowId: string,
    nodeId: string,
    status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED",
    input: Record<string, unknown>,
    output?: Record<string, unknown>,
    error?: string,
    durationMs?: number,
  ): Promise<void> {
    try {
      await fetch(`${baseUrl}/api/internal/node-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
        },
        body: JSON.stringify({
          runId,
          nodeId,
          workflowId,
          status,
          input,
          output,
          error,
          durationMs,
        }),
      });
    } catch {
      /* non-critical */
    }
  },

  async runStatus(
    baseUrl: string,
    runId: string,
    workflowId: string,
    status: "SUCCESS" | "FAILED" | "PARTIAL",
  ): Promise<void> {
    try {
      await fetch(`${baseUrl}/api/internal/run-complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
        },
        body: JSON.stringify({ runId, workflowId, status }),
      });
    } catch {
      /* non-critical */
    }
  },
};
