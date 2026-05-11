"use client";

import { useCallback, useRef } from "react";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { useExecutionStore } from "../store/executionStore";
import { compileDAG, computeExecutionSubgraph } from "../engine/dagCompiler";
import { resolveNodeInputs } from "../engine/inputResolver";
import { executeNode } from "../engine/mockExecutors";
import type { NodeOutputRegistry } from "../engine/inputResolver";

// ─── Execution orchestrator ───────────────────────────────────────────────────
// Architecture:
// 1. POST /api/workflows/[id]/run → creates DB Run, dispatches Trigger.dev task
// 2. If Trigger.dev is configured → backend orchestrates, frontend polls for updates
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

  const isExecutingRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Poll DB for live updates (used when Trigger.dev is active) ─────────────

  function startPolling(runId: string, workflowId: string) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/run/${runId}`);
        if (!res.ok) return;

        const run = await res.json();

        // Update node statuses from DB
        for (const nodeRun of run.nodeRuns ?? []) {
          const statusMap: Record<
            string,
            "queued" | "running" | "success" | "failed" | "idle"
          > = {
            PENDING: "queued",
            RUNNING: "running",
            SUCCESS: "success",
            FAILED: "failed",
          };
          const status = statusMap[nodeRun.status] ?? "idle";
          useExecutionStore.getState().setNodeStatus(nodeRun.nodeId, status);

          // Update canvas node data with outputs
          if (nodeRun.status === "SUCCESS" && nodeRun.output) {
            const output = nodeRun.output as Record<string, unknown>;
            if (nodeRun.nodeType === "gemini" && output.response) {
              updateNodeData(nodeRun.nodeId, { response: output.response });
            } else if (
              nodeRun.nodeType === "crop-image" &&
              output.outputImageUrl
            ) {
              updateNodeData(nodeRun.nodeId, {
                outputImageUrl: output.outputImageUrl,
              });
            } else if (nodeRun.nodeType === "response" && output.result) {
              updateNodeData(nodeRun.nodeId, { result: output.result });
            }
          }
        }

        // Check if run is complete
        if (["SUCCESS", "FAILED", "PARTIAL"].includes(run.status)) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;

          const statusMap: Record<string, "success" | "failed" | "partial"> = {
            SUCCESS: "success",
            FAILED: "failed",
            PARTIAL: "partial",
          };
          useExecutionStore
            .getState()
            .finishRun(statusMap[run.status] ?? "failed");
          setIsRunning(false, null);
          isExecutingRef.current = false;
        }
      } catch {
        // Polling errors are non-critical
      }
    }, 1500); // Poll every 1.5 seconds
  }

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

      exec().startRun(runId, scope, executionNodeIds);

      if (distributed && runId) {
        // Backend is orchestrating via Trigger.dev — poll for updates
        startPolling(runId, workflowId);
      } else {
        // Dev mode — frontend orchestrates with mock executors
        await runFrontendOrchestration(runId, workflowId, scope, targetNodeIds);
      }
    },
    [updateNodeData, setIsRunning],
  );

  return {
    runFull: () => runExecution("full"),
    runSelected: (nodeIds: string[]) => runExecution("selected", nodeIds),
    runSingle: (nodeId: string) => runExecution("single", [nodeId]),
  };
}
