import { task, logger, metadata } from "@trigger.dev/sdk/v3";
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
import { db } from "@/lib/db";

export const workflowOrchestratorTask = task({
  id: "workflow-orchestrate",
  maxDuration: 600,

  run: async (payload: WorkflowTaskPayload): Promise<void> => {
    const { runId, workflowId, nodes, edges, scope, targetNodeIds } = payload;

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
      return;
    }

    const safeDag = dag!;

    let executionSet: Set<string>;
    if (scope === "FULL") {
      executionSet = new Set((nodes as WorkflowNode[]).map((n) => n.id));
    } else if (targetNodeIds?.length) {
      executionSet = computeExecutionSubgraph(targetNodeIds, dag);
    } else {
      executionSet = new Set((nodes as WorkflowNode[]).map((n) => n.id));
    }

    const executionNodeIds = safeDag.executionOrder.filter((id) =>
      executionSet.has(id),
    );

    if (executionNodeIds.length === 0) {
      return;
    }

    // Initialize metadata tracking
    let completedNodeCount = 0;
    const totalNodeCount = executionNodeIds.length;

    // Set initial metadata
    metadata.set("completedNodeCount", 0);
    metadata.set("totalNodeCount", totalNodeCount);
    metadata.set("runStatus", "running");

    // Mark all nodes as queued in metadata
    for (const nodeId of executionNodeIds) {
      metadata.set(`nodes.${nodeId}.status`, "queued");
    }

    const outputRegistry: NodeOutputRegistry = new Map();
    const completed = new Set<string>();
    const failed = new Set<string>();
    const skipped = new Set<string>();
    const nodeRunIds = new Map<string, string>(); // Track NodeRun IDs for updates

    function isReady(nodeId: string): boolean {
      const compiled = safeDag.nodes.get(nodeId);
      if (!compiled) return false;
      const upstreamInSet = compiled.upstreamIds.filter((id) =>
        executionSet.has(id),
      );
      if (upstreamInSet.some((id) => failed.has(id) || skipped.has(id)))
        return false;
      return upstreamInSet.every((id) => completed.has(id));
    }

    function shouldSkip(nodeId: string): boolean {
      const compiled = safeDag.nodes.get(nodeId);
      if (!compiled) return false;
      //
      return compiled.upstreamIds
        .filter((id) => executionSet.has(id))
        .some((id) => failed.has(id) || skipped.has(id));
    }

    async function executeOneNode(nodeId: string): Promise<void> {
      const node = (nodes as WorkflowNode[]).find((n) => n.id === nodeId);
      if (!node) return;

      const nodeType = node.type ?? "unknown";
      const compiled = safeDag.nodes.get(nodeId)!;

      if (shouldSkip(nodeId)) {
        skipped.add(nodeId);
        // Update metadata for skipped node
        metadata.set(`nodes.${nodeId}.status`, "skipped");
        // Increment completed count
        completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
        metadata.set("completedNodeCount", completedNodeCount);
        return;
      }

      const inputs = resolveNodeInputs(
        nodeId,
        nodes as WorkflowNode[],
        compiled,
        outputRegistry,
      );

      // Update metadata: node is now running
      metadata.set(`nodes.${nodeId}.status`, "running");
      const startedAtMs = Date.now();
      metadata.set(`nodes.${nodeId}.startedAt`, startedAtMs);

      // Request-Inputs and Response run inline (no Trigger.dev task)
      if (nodeType === "request-inputs" || nodeType === "response") {
        await new Promise((r) => setTimeout(r, 100));
        const output =
          nodeType === "request-inputs"
            ? { ...inputs }
            : { result: inputs.result ?? null };
        outputRegistry.set(nodeId, output);
        completed.add(nodeId);

        // Update metadata: node succeeded
        const durationMs = Date.now() - startedAtMs;
        metadata.set(`nodes.${nodeId}.status`, "success");
        metadata.set(`nodes.${nodeId}.output`, output as any);
        metadata.set(`nodes.${nodeId}.durationMs`, durationMs);

        // Increment completed count
        completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
        metadata.set("completedNodeCount", completedNodeCount);

        // Persist to database
        try {
          const nodeRun = await db.nodeRun.create({
            data: {
              runId,
              nodeId,
              nodeType,
              status: "SUCCESS",
              input: inputs as any,
              output: output as any,
              startedAt: new Date(startedAtMs),
              finishedAt: new Date(),
              duration: durationMs,
            },
          });
          nodeRunIds.set(nodeId, nodeRun.id);
        } catch (err) {
          logger.error("Failed to persist NodeRun to database", {
            nodeId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }

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
        };
        let result: { output: Record<string, unknown>; durationMs: number };

        if (nodeType === "gemini") {
          // Set stream name in metadata before Gemini task starts
          const streamName = `gemini-response-${nodeId}`;
          metadata.set(`nodes.${nodeId}.streamName`, streamName);

          const handle = await geminiTask.triggerAndWait(taskPayload);
          if (!handle.ok) throw new Error("Gemini task failed");
          result = handle.output;
        } else if (nodeType === "crop-image") {
          const handle = await cropImageTask.triggerAndWait(taskPayload);
          if (!handle.ok) throw new Error("Crop Image task failed");
          result = handle.output;
        } else {
          skipped.add(nodeId);
          // Update metadata for skipped node
          metadata.set(`nodes.${nodeId}.status`, "skipped");
          // Increment completed count
          completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
          metadata.set("completedNodeCount", completedNodeCount);
          return;
        }

        outputRegistry.set(nodeId, result.output);
        completed.add(nodeId);

        // Update metadata: node succeeded
        metadata.set(`nodes.${nodeId}.status`, "success");
        metadata.set(`nodes.${nodeId}.output`, result.output as any);
        metadata.set(`nodes.${nodeId}.durationMs`, result.durationMs);

        // Increment completed count
        completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
        metadata.set("completedNodeCount", completedNodeCount);

        // Persist to database
        try {
          const nodeRun = await db.nodeRun.create({
            data: {
              runId,
              nodeId,
              nodeType,
              status: "SUCCESS",
              input: inputs as any,
              output: result.output as any,
              startedAt: new Date(startedAtMs),
              finishedAt: new Date(),
              duration: result.durationMs,
            },
          });
          nodeRunIds.set(nodeId, nodeRun.id);
        } catch (err) {
          logger.error("Failed to persist NodeRun to database", {
            nodeId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Task failed";
        logger.error("Node execution failed", { nodeId, nodeType, errorMsg });
        failed.add(nodeId);

        // Update metadata: node failed
        const durationMs = Date.now() - startedAtMs;
        metadata.set(`nodes.${nodeId}.status`, "failed");
        metadata.set(`nodes.${nodeId}.error`, errorMsg);
        metadata.set(`nodes.${nodeId}.durationMs`, durationMs);

        // Increment completed count
        completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
        metadata.set("completedNodeCount", completedNodeCount);

        // Persist to database
        try {
          const nodeRun = await db.nodeRun.create({
            data: {
              runId,
              nodeId,
              nodeType,
              status: "FAILED",
              input: inputs as any,
              error: errorMsg,
              startedAt: new Date(startedAtMs),
              finishedAt: new Date(),
              duration: durationMs,
            },
          });
          nodeRunIds.set(nodeId, nodeRun.id);
        } catch (err) {
          logger.error("Failed to persist failed NodeRun to database", {
            nodeId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    const inFlight = new Set<string>();
    const pending = new Set(executionNodeIds);

    async function executeBatchTasks(type: "gemini" | "crop-image", nodeIds: string[]): Promise<void> {
      const payloads: any[] = [];
      const startedAts = new Map<string, number>();

      for (const nodeId of nodeIds) {
        const compiled = safeDag.nodes.get(nodeId)!;
        const inputs = resolveNodeInputs(nodeId, nodes as WorkflowNode[], compiled, outputRegistry);

        metadata.set(`nodes.${nodeId}.status`, "running");
        const startedAtMs = Date.now();
        startedAts.set(nodeId, startedAtMs);
        metadata.set(`nodes.${nodeId}.startedAt`, startedAtMs);

        if (type === "gemini") {
          metadata.set(`nodes.${nodeId}.streamName`, `gemini-response-${nodeId}`);
        }

        payloads.push({
          payload: {
            runId,
            workflowId,
            nodeId,
            nodeType: type,
            inputs
          }
        });
      }

      try {
        // To this:
        let results: any[];
        if (type === "gemini") {
          const batchResult = await geminiTask.batchTriggerAndWait(payloads);
          results = batchResult.runs;
        } else {
          const batchResult = await cropImageTask.batchTriggerAndWait(payloads);
          results = batchResult.runs;
        }

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const nodeId = nodeIds[i];
          const startedAtMs = startedAts.get(nodeId)!;
          const durationMs = Date.now() - startedAtMs;

          if (result.ok) {
            const output = result.output.output;
            const actualDuration = result.output.durationMs;
            outputRegistry.set(nodeId, output);
            completed.add(nodeId);

            metadata.set(`nodes.${nodeId}.status`, "success");
            metadata.set(`nodes.${nodeId}.output`, output as any);
            metadata.set(`nodes.${nodeId}.durationMs`, actualDuration);
            completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
            metadata.set("completedNodeCount", completedNodeCount);

            try {
              const nodeRun = await db.nodeRun.create({
                data: {
                  runId, nodeId, nodeType: type, status: "SUCCESS",
                  input: payloads[i].payload.inputs as any,
                  output: output as any,
                  startedAt: new Date(startedAtMs),
                  finishedAt: new Date(),
                  duration: actualDuration,
                }
              });
              nodeRunIds.set(nodeId, nodeRun.id);
            } catch (err) { }
          } else {
            failed.add(nodeId);
            const errorMsg = result.error?.message || "Task failed";
            metadata.set(`nodes.${nodeId}.status`, "failed");
            metadata.set(`nodes.${nodeId}.error`, errorMsg);
            metadata.set(`nodes.${nodeId}.durationMs`, durationMs);
            completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
            metadata.set("completedNodeCount", completedNodeCount);

            try {
              const nodeRun = await db.nodeRun.create({
                data: {
                  runId, nodeId, nodeType: type, status: "FAILED",
                  input: payloads[i].payload.inputs as any,
                  error: errorMsg,
                  startedAt: new Date(startedAtMs),
                  finishedAt: new Date(),
                  duration: durationMs,
                }
              });
              nodeRunIds.set(nodeId, nodeRun.id);
            } catch (err) { }
          }
        }
      } catch (err) {
        for (let i = 0; i < nodeIds.length; i++) {
          const nodeId = nodeIds[i];
          failed.add(nodeId);
          const startedAtMs = startedAts.get(nodeId)!;
          const durationMs = Date.now() - startedAtMs;
          const errorMsg = err instanceof Error ? err.message : "Batch execution failed";

          metadata.set(`nodes.${nodeId}.status`, "failed");
          metadata.set(`nodes.${nodeId}.error`, errorMsg);
          metadata.set(`nodes.${nodeId}.durationMs`, durationMs);
          completedNodeCount = Math.min(completedNodeCount + 1, totalNodeCount);
          metadata.set("completedNodeCount", completedNodeCount);
          try {
            await db.nodeRun.create({
              data: {
                runId, nodeId, nodeType: type, status: "FAILED",
                input: payloads[i].payload.inputs as any,
                error: errorMsg,
                startedAt: new Date(startedAtMs),
                finishedAt: new Date(),
                duration: durationMs,
              }
            });
          } catch (e) { }
        }
      }
    }

    async function scheduleReady(): Promise<void> {
      const toStart: string[] = [];
      for (const nodeId of pending) {
        if (inFlight.has(nodeId)) continue;
        if (shouldSkip(nodeId)) {
          pending.delete(nodeId);
          skipped.add(nodeId);
          continue;
        }
        if (isReady(nodeId)) toStart.push(nodeId);
      }

      if (toStart.length === 0) return;

      const inlineNodes: string[] = [];
      const geminiNodes: string[] = [];
      const cropNodes: string[] = [];

      for (const nodeId of toStart) {
        pending.delete(nodeId);
        inFlight.add(nodeId);
        const node = (nodes as WorkflowNode[]).find((n) => n.id === nodeId);
        const type = node?.type;
        if (type === "request-inputs" || type === "response") inlineNodes.push(nodeId);
        else if (type === "gemini") geminiNodes.push(nodeId);
        else if (type === "crop-image") cropNodes.push(nodeId);
        else {
          inFlight.delete(nodeId);
          skipped.add(nodeId);
          metadata.set(`nodes.${nodeId}.status`, "skipped");
        }
      }

      if (inlineNodes.length > 0) {
        await Promise.all(inlineNodes.map(async (nodeId) => {
          await executeOneNode(nodeId);
          inFlight.delete(nodeId);
        }));
      }

      if (geminiNodes.length > 0) {
        if (geminiNodes.length === 1) {
          await executeOneNode(geminiNodes[0]);
          inFlight.delete(geminiNodes[0]);
        } else {
          await executeBatchTasks("gemini", geminiNodes);
          for (const id of geminiNodes) inFlight.delete(id);
        }
      }

      if (cropNodes.length > 0) {
        if (cropNodes.length === 1) {
          await executeOneNode(cropNodes[0]);
          inFlight.delete(cropNodes[0]);
        } else {
          await executeBatchTasks("crop-image", cropNodes);
          for (const id of cropNodes) inFlight.delete(id);
        }
      }

      await scheduleReady();
    }

    await scheduleReady();

    let finalStatus: "success" | "failed" | "partial";
    if (failed.size === 0 && skipped.size === 0) finalStatus = "success";
    else if (completed.size === 0) finalStatus = "failed";
    else finalStatus = "partial";

    // Update metadata with final status
    metadata.set("runStatus", finalStatus);

    // Update Run record in database
    try {
      const finishedAt = new Date();
      const startedAt = new Date(Date.now() - (Date.now() - Date.now())); // Approximate
      const duration = finishedAt.getTime() - startedAt.getTime();

      await db.run.update({
        where: { id: runId },
        data: {
          status: finalStatus.toUpperCase() as "SUCCESS" | "FAILED" | "PARTIAL",
          finishedAt,
          duration,
        },
      });
    } catch (err) {
      logger.error("Failed to update Run record in database", {
        runId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    logger.info("Workflow orchestration completed", {
      runId,
      finalStatus,
      completed: completed.size,
      failed: failed.size,
      skipped: skipped.size,
    });
  },
});
