"use client";

import { useCallback, useRef } from "react";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { useExecutionStore } from "../store/executionStore";
import { useWorkflowRunRealtime } from "./useWorkflowRunRealtime";
import { useWorkflowStream } from "./useWorkflowStream";
import { compileDAG, computeExecutionSubgraph } from "../engine/dagCompiler";
import { resolveNodeInputs } from "../engine/inputResolver";
import { executeNode } from "../engine/mockExecutors";
import type { NodeOutputRegistry } from "../engine/inputResolver";

// ─── Execution orchestrator ───────────────────────────────────────────────────
// Architecture:
// 1. POST /api/workflows/[id]/run → creates DB Run, dispatches Trigger.dev task
// 2. If Trigger.dev is configured → backend orchestrates, frontend subscribes via realtime hooks
// 3. If not configured (dev mode) → frontend orchestrates with mock executors
// ─────────────────────────────────────────────────────────────────────────────

// Helper: always get fresh store references to avoid stale closures
function exec() {
  return useExecutionStore.getState();
}
function editor() {
  return useWorkflowEditorStore.getState();
}

export function useWorkflowExecution() {
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData);
  const setIsRunning = useWorkflowEditorStore((s) => s.setIsRunning);
  const setTriggerRunId = useWorkflowEditorStore((s) => s.setTriggerRunId);
  const setPublicToken = useWorkflowEditorStore((s) => s.setPublicToken);
  const triggerRunId = useWorkflowEditorStore((s) => s.triggerRunId);
  const publicToken = useWorkflowEditorStore((s) => s.publicToken);
  const nodes = useWorkflowEditorStore((s) => s.nodes);

  const isExecutingRef = useRef(false);

  // Subscribe to realtime updates when triggerRunId and publicToken are available
  useWorkflowRunRealtime({
    triggerRunId,
    publicToken,
  });

  // Subscribe to Gemini streams for the first Gemini node found.
  // IMPORTANT: hooks must be called unconditionally — pass null when no Gemini
  // node exists; useWorkflowStream handles null params with an early return.
  const firstGeminiNode = nodes.find((node) => node.type === "gemini");
  const geminiNodeData = firstGeminiNode?.data as
    | Record<string, unknown>
    | undefined;
  const geminiStreamName = (geminiNodeData?.streamName as string) ?? null;

  useWorkflowStream({
    triggerRunId,
    nodeId: firstGeminiNode?.id ?? null,
    streamName: geminiStreamName,
    publicToken,
  });

  // ─── Frontend fallback orchestrator (dev mode / no Trigger.dev) ─────────────

  async function runFrontendOrchestration(
    runId: string,
    workflowId: string,
    scope: "full" | "selected" | "single",
    targetNodeIds?: string[],
  ) {
    const currentNodes = useWorkflowEditorStore.getState().nodes;
    const currentEdges = useWorkflowEditorStore.getState().edges;

    const { dag: compiledDag, error } = compileDAG(currentNodes, currentEdges);
    if (!compiledDag || error) {
      console.error(`[NextFlow] ❌ DAG compile failed:`, error?.message);
      return;
    }
    const dag = compiledDag;

    let executionSet: Set<string>;
    if (scope === "full") {
      executionSet = new Set(currentNodes.map((n) => n.id));
    } else if (targetNodeIds?.length) {
      executionSet = computeExecutionSubgraph(targetNodeIds, dag);
    } else {
      executionSet = new Set(currentNodes.map((n) => n.id));
    }

    const executionNodeIds = dag.executionOrder.filter((id) =>
      executionSet.has(id),
    );

    const outputRegistry: NodeOutputRegistry = new Map();
    const completed = new Set<string>();
    const failed = new Set<string>();

    function isReady(nodeId: string): boolean {
      const compiled = dag.nodes.get(nodeId);
      if (!compiled) return false;
      return compiled.upstreamIds
        .filter((id) => executionSet.has(id))
        .every((id) => completed.has(id));
    }

    async function executeOneNode(nodeId: string): Promise<void> {
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) {
        return;
      }

      const compiled = dag.nodes.get(nodeId)!;
      const nodeType = node.type ?? "unknown";
      const inputs = resolveNodeInputs(
        nodeId,
        currentNodes,
        compiled,
        outputRegistry,
      );

      useExecutionStore.getState().setNodeStatus(nodeId, "running");
      useExecutionStore.getState().recordNodeStart(nodeId, nodeType, inputs);

      const startTime = Date.now();

      try {
        const result = await executeNode(nodeType, inputs);
        const durationMs = Date.now() - startTime;

        outputRegistry.set(nodeId, result.output);

        if (nodeType === "gemini" && result.output.response) {
          updateNodeData(nodeId, { response: result.output.response });
        } else if (nodeType === "crop-image" && result.output.outputImageUrl) {
          updateNodeData(nodeId, {
            outputImageUrl: result.output.outputImageUrl,
          });
        } else if (nodeType === "response" && result.output.result) {
          updateNodeData(nodeId, { result: result.output.result });
        }

        useExecutionStore
          .getState()
          .recordNodeSuccess(nodeId, result.output, durationMs);
        completed.add(nodeId);

        // Persist to DB
        await fetch(`/api/workflows/${workflowId}/run/${runId}/nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId,
            nodeType,
            status: "SUCCESS",
            input: inputs,
            output: result.output,
            duration: durationMs,
            finishedAt: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const errorMsg =
          err instanceof Error ? err.message : "Execution failed";
        console.error(
          `[NextFlow] ❌ Node failed: ${nodeId} (${nodeType}) after ${durationMs}ms:`,
          errorMsg,
        );
        useExecutionStore
          .getState()
          .recordNodeFailure(nodeId, errorMsg, durationMs);
        failed.add(nodeId);
      }
    }

    const inFlight = new Set<string>();
    const pending = new Set(executionNodeIds);

    async function scheduleReady(): Promise<void> {
      const toStart = [...pending].filter(
        (id) => !inFlight.has(id) && isReady(id),
      );
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

    const finalStatus =
      failed.size === 0
        ? "success"
        : completed.size === 0
          ? "failed"
          : "partial";

    useExecutionStore.getState().finishRun(finalStatus);
    setIsRunning(false, null);
    isExecutingRef.current = false;

    // Update DB run status
    const dbStatus =
      finalStatus === "success"
        ? "SUCCESS"
        : finalStatus === "failed"
          ? "FAILED"
          : "PARTIAL";

    await fetch(`/api/workflows/${workflowId}/run/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: dbStatus,
        finishedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  // ─── Main entry point ────────────────────────────────────────────────────────

  const runExecution = useCallback(
    async (scope: "full" | "selected" | "single", targetNodeIds?: string[]) => {
      if (isExecutingRef.current) return;

      const { workflowId, nodes, edges } = useWorkflowEditorStore.getState();
      if (!workflowId) return;

      // Validate DAG before starting
      const { dag, error } = compileDAG(nodes, edges);
      if (!dag || error) {
        console.error("[Execution] DAG error:", error?.message);
        return;
      }

      // Clean up removed edges from workflow store
      if (dag.removedEdges.length > 0) {
        const cleanedEdges = edges.filter(
          (e) =>
            !dag.removedEdges.some(
              (re) => re.source === e.source && re.target === e.target,
            ),
        );
        useWorkflowEditorStore.setState({ edges: cleanedEdges });
      }

      isExecutingRef.current = true;

      const scopeMap = {
        full: "FULL" as const,
        selected: "PARTIAL" as const,
        single: "SINGLE_NODE" as const,
      };

      // Determine execution set for UI initialization
      let executionSet: Set<string>;
      if (scope === "full") {
        executionSet = new Set(nodes.map((n) => n.id));
      } else if (targetNodeIds?.length) {
        executionSet = computeExecutionSubgraph(targetNodeIds, dag);
      } else {
        executionSet = new Set(nodes.map((n) => n.id));
      }

      const executionNodeIds = dag.executionOrder.filter((id) =>
        executionSet.has(id),
      );

      // Initialize UI state
      exec().resetNodeStatuses();
      setIsRunning(true, scope);

      // POST to backend — creates DB run and dispatches Trigger.dev task
      let runId: string | null = null;
      let distributed = false;
      let newTriggerRunId: string | null = null;
      let newPublicToken: string | null = null;

      try {
        const res = await fetch(`/api/workflows/${workflowId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: scopeMap[scope],
            targetNodeIds,
            nodes,
            edges,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          runId = data.runId as string;
          distributed = data.distributed as boolean;
          newTriggerRunId = data.triggerRunId as string | null;
          newPublicToken = data.publicToken as string | null;
        } else {
          const errText = await res.text().catch(() => "unknown");
          console.error(
            `[NextFlow] ❌ Failed to create run:`,
            res.status,
            errText,
          );
        }
      } catch (e) {
        console.error(`[NextFlow] ❌ Exception creating run:`, e);
      }

      if (!runId) {
        runId = `local-${Date.now()}`;
      }

      // Store Trigger.dev run ID and token for realtime subscription
      if (newTriggerRunId) {
        setTriggerRunId(newTriggerRunId);
      }
      if (newPublicToken) {
        setPublicToken(newPublicToken);
      }

      exec().startRun(runId, scope, executionNodeIds);

      // If distributed mode is enabled, realtime hooks will handle updates
      // Otherwise, frontend orchestrates with mock executors
      if (!distributed) {
        await runFrontendOrchestration(runId, workflowId, scope, targetNodeIds);
      }
    },
    [updateNodeData, setIsRunning, setTriggerRunId, setPublicToken],
  );

  return {
    runFull: () => runExecution("full"),
    runSelected: (nodeIds: string[]) => runExecution("selected", nodeIds),
    runSingle: (nodeId: string) => runExecution("single", [nodeId]),
  };
}
