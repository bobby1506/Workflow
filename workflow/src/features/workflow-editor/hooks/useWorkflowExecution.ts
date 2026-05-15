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

  // ─── Frontend fallback orchestrator (dev mode / no Trigger.dev) ─────────────

  async function runFrontendOrchestration(
    runId: string,
    workflowId: string,
    scope: "full" | "selected" | "single",
    targetNodeIds?: string[],
  ) {
    const currentNodes = useWorkflowEditorStore.getState().nodes;
    const currentEdges = useWorkflowEditorStore.getState().edges;

    console.log("[useWorkflowExecution] runFrontendOrchestration started:", {
      runId,
      workflowId,
      scope,
      targetNodeIds,
      nodesCount: currentNodes?.length ?? 0,
      edgesCount: currentEdges?.length ?? 0,
    });

    if (!currentNodes || !Array.isArray(currentNodes)) {
      console.error(
        "[useWorkflowExecution] Invalid nodes in runFrontendOrchestration:",
        {
          nodesType: typeof currentNodes,
          isArray: Array.isArray(currentNodes),
        },
      );
      return;
    }

    if (!currentEdges || !Array.isArray(currentEdges)) {
      console.error(
        "[useWorkflowExecution] Invalid edges in runFrontendOrchestration:",
        {
          edgesType: typeof currentEdges,
          isArray: Array.isArray(currentEdges),
        },
      );
      return;
    }

    const { dag: compiledDag, error } = compileDAG(currentNodes, currentEdges);
    if (!compiledDag || error) {
      console.error(`[NextFlow] ❌ DAG compile failed:`, error?.message);
      return;
    }
    const dag = compiledDag;

    console.log("[useWorkflowExecution] DAG compiled successfully:", {
      nodeCount: dag.nodes.size,
      executionOrderLength: dag.executionOrder?.length ?? 0,
    });

    let executionSet: Set<string>;
    if (scope === "full") {
      executionSet = new Set(currentNodes.map((n) => n.id));
      console.log("[useWorkflowExecution] Full scope - executing all nodes");
    } else if (
      targetNodeIds &&
      Array.isArray(targetNodeIds) &&
      targetNodeIds.length > 0
    ) {
      console.log(
        `[useWorkflowExecution] Selected scope - computing subgraph for ${targetNodeIds.length} target nodes`,
      );
      executionSet = computeExecutionSubgraph(targetNodeIds, dag);
      console.log(
        `[useWorkflowExecution] Subgraph computed - ${executionSet.size} nodes to execute`,
      );
    } else {
      executionSet = new Set(currentNodes.map((n) => n.id));
      console.log("[useWorkflowExecution] Default scope - executing all nodes");
    }

    const executionNodeIds = dag.executionOrder.filter((id) =>
      executionSet.has(id),
    );

    console.log("[useWorkflowExecution] Execution order determined:", {
      totalToExecute: executionNodeIds.length,
      executionOrder: executionNodeIds,
    });

    const outputRegistry: NodeOutputRegistry = new Map();
    const completed = new Set<string>();
    const failed = new Set<string>();

    function isReady(nodeId: string): boolean {
      const compiled = dag.nodes.get(nodeId);
      if (!compiled) {
        console.warn(
          `[useWorkflowExecution] Node ${nodeId} not found in compiled DAG`,
        );
        return false;
      }
      const upstreamIds = compiled.upstreamIds.filter((id) =>
        executionSet.has(id),
      );
      const isReady = upstreamIds.every((id) => completed.has(id));
      if (!isReady && upstreamIds.length > 0) {
        console.log(
          `[useWorkflowExecution] Node ${nodeId} not ready - waiting for: ${upstreamIds.filter((id) => !completed.has(id)).join(", ")}`,
        );
      }
      return isReady;
    }

    async function executeOneNode(nodeId: string): Promise<void> {
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(
          `[useWorkflowExecution] Node ${nodeId} not found in currentNodes`,
        );
        return;
      }

      const compiled = dag.nodes.get(nodeId);
      if (!compiled) {
        console.error(
          `[useWorkflowExecution] Node ${nodeId} not found in compiled DAG`,
        );
        return;
      }

      const nodeType = node.type ?? "unknown";
      console.log(
        `[useWorkflowExecution] Executing node ${nodeId} (${nodeType})`,
      );

      const inputs = resolveNodeInputs(
        nodeId,
        currentNodes,
        compiled,
        outputRegistry,
      );

      console.log(`[useWorkflowExecution] Resolved inputs for ${nodeId}:`, {
        inputKeys: Object.keys(inputs),
      });

      useExecutionStore.getState().setNodeStatus(nodeId, "running");
      useExecutionStore.getState().recordNodeStart(nodeId, nodeType, inputs);

      const startTime = Date.now();

      try {
        console.log(
          `[useWorkflowExecution] Calling executeNode for ${nodeId} (${nodeType})`,
        );
        const result = await executeNode(nodeType, inputs);
        const durationMs = Date.now() - startTime;

        console.log(
          `[useWorkflowExecution] Node ${nodeId} completed in ${durationMs}ms`,
          {
            hasOutput: !!result.output,
            outputKeys: result.output ? Object.keys(result.output) : [],
          },
        );

        outputRegistry.set(nodeId, result.output);

        if (nodeType === "gemini" && result.output.response) {
          console.log(
            `[useWorkflowExecution] Updating node ${nodeId} with gemini response`,
          );
          updateNodeData(nodeId, { response: result.output.response });
        } else if (nodeType === "crop-image" && result.output.outputImageUrl) {
          console.log(
            `[useWorkflowExecution] Updating node ${nodeId} with crop output`,
          );
          updateNodeData(nodeId, {
            outputImageUrl: result.output.outputImageUrl,
          });
        } else if (nodeType === "response" && result.output.result) {
          console.log(
            `[useWorkflowExecution] Updating node ${nodeId} with response result`,
          );
          updateNodeData(nodeId, { result: result.output.result });
        }

        useExecutionStore
          .getState()
          .recordNodeSuccess(nodeId, result.output, durationMs);
        completed.add(nodeId);

        // Persist to DB
        console.log(
          `[useWorkflowExecution] Persisting node ${nodeId} to database`,
        );
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
        }).catch((err) => {
          console.error(
            `[useWorkflowExecution] Failed to persist node ${nodeId}:`,
            err,
          );
        });
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

      if (!Array.isArray(toStart)) {
        console.error(
          "[useWorkflowExecution] toStart is not an array:",
          typeof toStart,
        );
        return;
      }

      if (toStart.length === 0) {
        console.log("[useWorkflowExecution] No nodes ready to start");
        return;
      }

      console.log(
        `[useWorkflowExecution] Scheduling ${toStart.length} nodes: ${toStart.join(", ")}`,
      );

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

    console.log("[useWorkflowExecution] Frontend orchestration completed:", {
      finalStatus,
      completed: completed.size,
      failed: failed.size,
      total: executionNodeIds.length,
    });

    useExecutionStore.getState().finishRun(finalStatus);
    setIsRunning(false, null);

    // Update DB run status
    const dbStatus =
      finalStatus === "success"
        ? "SUCCESS"
        : finalStatus === "failed"
          ? "FAILED"
          : "PARTIAL";

    console.log(`[useWorkflowExecution] Updating DB run status to ${dbStatus}`);
    await fetch(`/api/workflows/${workflowId}/run/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: dbStatus,
        finishedAt: new Date().toISOString(),
      }),
    }).catch((err) => {
      console.error(
        "[useWorkflowExecution] Failed to update DB run status:",
        err,
      );
    });
  }

  // ─── Main entry point ────────────────────────────────────────────────────────

  const runExecution = useCallback(
    async (scope: "full" | "selected" | "single", targetNodeIds?: string[]) => {
      console.log("[useWorkflowExecution] runExecution called with:", {
        scope,
        targetNodeIds,
        isAlreadyExecuting: useWorkflowEditorStore.getState().isRunning,
      });

      if (useWorkflowEditorStore.getState().isRunning) {
        console.log("[useWorkflowExecution] Already executing, skipping");
        return;
      }

      const storeState = useWorkflowEditorStore.getState();
      const { workflowId, nodes, edges } = storeState;

      console.log("[useWorkflowExecution] Store state retrieved:", {
        workflowId,
        nodesType: typeof nodes,
        nodesIsArray: Array.isArray(nodes),
        nodesCount: Array.isArray(nodes) ? nodes.length : "N/A",
        edgesType: typeof edges,
        edgesIsArray: Array.isArray(edges),
        edgesCount: Array.isArray(edges) ? edges.length : "N/A",
      });

      if (!workflowId) {
        console.error("[useWorkflowExecution] Missing workflowId");
        return;
      }

      if (!nodes || !Array.isArray(nodes)) {
        console.error("[useWorkflowExecution] Invalid nodes:", {
          nodesType: typeof nodes,
          isArray: Array.isArray(nodes),
        });
        return;
      }

      if (!edges || !Array.isArray(edges)) {
        console.error("[useWorkflowExecution] Invalid edges:", {
          edgesType: typeof edges,
          isArray: Array.isArray(edges),
        });
        return;
      }

      // Validate DAG before starting
      console.log("[useWorkflowExecution] Compiling DAG...");
      const { dag, error } = compileDAG(nodes, edges);
      if (!dag || error) {
        console.error("[useWorkflowExecution] DAG compile failed:", error);
        return;
      }
      console.log("[useWorkflowExecution] DAG compiled successfully");

      // Clean up removed edges from workflow store
      if (dag.removedEdges && Array.isArray(dag.removedEdges)) {
        if (dag.removedEdges.length > 0) {
          console.log(
            `[useWorkflowExecution] Cleaning up ${dag.removedEdges.length} removed edges`,
          );
          const cleanedEdges = edges.filter(
            (e) =>
              !dag.removedEdges.some(
                (re) => re.source === e.source && re.target === e.target,
              ),
          );
          useWorkflowEditorStore.setState({ edges: cleanedEdges });
        }
      } else {
        console.warn(
          "[useWorkflowExecution] dag.removedEdges is not an array:",
          typeof dag.removedEdges,
        );
      }

      const scopeMap = {
        full: "FULL" as const,
        selected: "PARTIAL" as const,
        single: "SINGLE_NODE" as const,
      };

      // Determine execution set for UI initialization
      let executionSet: Set<string>;
      if (scope === "full") {
        executionSet = new Set(nodes.map((n) => n.id));
        console.log("[useWorkflowExecution] Full scope - all nodes");
      } else if (
        targetNodeIds &&
        Array.isArray(targetNodeIds) &&
        targetNodeIds.length > 0
      ) {
        console.log(
          `[useWorkflowExecution] Selected scope - ${targetNodeIds.length} target nodes`,
        );
        executionSet = computeExecutionSubgraph(targetNodeIds, dag);
        console.log(
          `[useWorkflowExecution] Subgraph computed - ${executionSet.size} nodes`,
        );
      } else {
        executionSet = new Set(nodes.map((n) => n.id));
        console.log("[useWorkflowExecution] Default scope - all nodes");
      }

      const executionNodeIds = dag.executionOrder.filter((id) =>
        executionSet.has(id),
      );

      console.log("[useWorkflowExecution] Execution plan:", {
        scope,
        executionNodeIds: executionNodeIds.length,
        totalNodes: nodes.length,
        executionOrder: executionNodeIds,
      });

      // Initialize UI state
      exec().resetNodeStatuses();
      setIsRunning(true, scope);

      // POST to backend — creates DB run and dispatches Trigger.dev task
      let runId: string | null = null;
      let distributed = false;
      let newTriggerRunId: string | null = null;
      let newPublicToken: string | null = null;

      try {
        console.log("[useWorkflowExecution] Creating run via API...");
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

          console.log("[useWorkflowExecution] Run created successfully:", {
            runId,
            distributed,
            hasTriggerRunId: !!newTriggerRunId,
            hasPublicToken: !!newPublicToken,
          });
        } else {
          const errText = await res.text().catch(() => "unknown");
          console.error(
            `[useWorkflowExecution] Failed to create run:`,
            res.status,
            errText,
          );
        }
      } catch (e) {
        console.error(`[useWorkflowExecution] Exception creating run:`, e);
      }

      if (!runId) {
        runId = `local-${Date.now()}`;
        console.log("[useWorkflowExecution] Using local run ID:", runId);
      }

      // Store Trigger.dev run ID and token for realtime subscription
      if (newTriggerRunId) {
        console.log(
          "[useWorkflowExecution] Setting Trigger.dev run ID:",
          newTriggerRunId,
        );
        setTriggerRunId(newTriggerRunId);
      } else {
        console.log("[useWorkflowExecution] No Trigger.dev run ID returned");
      }

      if (newPublicToken) {
        console.log("[useWorkflowExecution] Setting public token");
        setPublicToken(newPublicToken);
      } else {
        console.log("[useWorkflowExecution] No public token returned");
      }

      exec().startRun(runId, scope, executionNodeIds);

      // If distributed mode is enabled, realtime hooks will handle updates
      // Otherwise, frontend orchestrates with mock executors
      if (!distributed) {
        console.log(
          "[useWorkflowExecution] Running frontend orchestration (dev mode)",
        );
        await runFrontendOrchestration(runId, workflowId, scope, targetNodeIds);
      } else {
        console.log(
          "[useWorkflowExecution] Distributed mode enabled, waiting for realtime updates",
        );
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
