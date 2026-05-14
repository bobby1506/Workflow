"use client";

import { useEffect, useRef } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useExecutionStore } from "../store/executionStore";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";

interface UseWorkflowRunRealtimeParams {
  triggerRunId: string | null | undefined;
  publicToken: string | null | undefined;
}

/**
 * Hook that subscribes to a Trigger.dev run's realtime metadata and maps changes
 * to the ExecutionStore and WorkflowEditorStore.
 *
 * Maps metadata changes:
 * - nodes.<nodeId>.status → setNodeStatus()
 * - nodes.<nodeId>.output → updateNodeData()
 * - runStatus transitions → finishRun() + setIsRunning(false)
 *
 * Ignores updates after run reaches terminal state (COMPLETED/FAILED/CANCELED).
 * Only triggers cleanup on actual transitions, not on initial observation.
 *
 * IMPORTANT: This hook MUST be called unconditionally (React Rules of Hooks).
 * When parameters are invalid, we use a ternary to avoid calling useRealtimeRun.
 */
export function useWorkflowRunRealtime({
  triggerRunId,
  publicToken,
}: UseWorkflowRunRealtimeParams): void {
  const executionStore = useExecutionStore();
  const workflowEditorStore = useWorkflowEditorStore();

  // Track whether we've already finished the run to avoid duplicate cleanup
  const hasFinishedRef = useRef(false);
  // Track the previous runStatus to detect transitions
  const previousRunStatusRef = useRef<string | null>(null);

  const hasValidParams = !!(triggerRunId && publicToken);

  console.log("[useWorkflowRunRealtime] Hook called with:", {
    triggerRunId,
    publicToken: publicToken ? "***" : null,
    hasValidParams,
  });

  // ✅ CRITICAL: Use a ternary to conditionally call useRealtimeRun
  // This prevents calling the hook with invalid parameters
  // while still complying with React's Rules of Hooks
  const { run } = hasValidParams
    ? useRealtimeRun(triggerRunId!, {
        accessToken: publicToken!,
      })
    : { run: null };

  console.log("[useWorkflowRunRealtime] useRealtimeRun returned:", {
    hasRun: !!run,
    runId: run?.id,
    runStatus: run?.status,
  });

  useEffect(() => {
    // Skip if run data not available
    if (!run) {
      console.log("[useWorkflowRunRealtime] No run data available yet");
      return;
    }

    console.log("[useWorkflowRunRealtime] Processing run update:", {
      runId: run.id,
      status: run.status,
      hasMetadata: !!run.metadata,
    });

    // Check if run has reached a terminal state
    const isTerminal =
      run.status === "COMPLETED" ||
      run.status === "FAILED" ||
      run.status === "CANCELED";

    console.log("[useWorkflowRunRealtime] Terminal state check:", {
      isTerminal,
      hasFinished: hasFinishedRef.current,
    });

    // If we've already finished this run, ignore further updates
    if (hasFinishedRef.current && isTerminal) {
      console.log("[useWorkflowRunRealtime] Already finished, ignoring update");
      return;
    }

    // Process metadata updates
    if (run.metadata) {
      const metadata = run.metadata as Record<string, unknown>;
      console.log("[useWorkflowRunRealtime] Processing metadata:", {
        hasNodes: !!metadata.nodes,
        hasRunStatus: !!metadata.runStatus,
      });

      // Update individual node statuses and outputs
      const nodes = metadata.nodes as Record<string, unknown> | undefined;
      if (nodes && typeof nodes === "object") {
        console.log("[useWorkflowRunRealtime] Found nodes in metadata");
        const nodeIds = Object.keys(nodes);
        console.log(
          `[useWorkflowRunRealtime] Processing ${nodeIds.length} nodes`,
        );

        for (const [nodeId, nodeData] of Object.entries(nodes)) {
          if (typeof nodeData === "object" && nodeData !== null) {
            const node = nodeData as Record<string, unknown>;

            // Update node status
            if (node.status && typeof node.status === "string") {
              console.log(
                `[useWorkflowRunRealtime] Setting node ${nodeId} status to ${node.status}`,
              );
              executionStore.setNodeStatus(nodeId, node.status as any);
            }

            // Update node output/data
            if (node.output && typeof node.output === "object") {
              console.log(
                `[useWorkflowRunRealtime] Updating node ${nodeId} data with output`,
              );
              workflowEditorStore.updateNodeData(nodeId, {
                response: node.output,
              });
            }
          }
        }
      } else {
        console.log(
          "[useWorkflowRunRealtime] No nodes found in metadata or nodes is not an object",
        );
      }

      // Handle runStatus transitions
      const runStatus = metadata.runStatus as string | undefined;
      console.log("[useWorkflowRunRealtime] Run status from metadata:", {
        runStatus,
        previousStatus: previousRunStatusRef.current,
      });

      if (runStatus && runStatus !== previousRunStatusRef.current) {
        previousRunStatusRef.current = runStatus;
        console.log(
          `[useWorkflowRunRealtime] Run status transitioned to: ${runStatus}`,
        );

        // Map Trigger.dev runStatus to ExecutionStore status
        if (
          runStatus === "success" ||
          runStatus === "failed" ||
          runStatus === "partial"
        ) {
          if (!hasFinishedRef.current) {
            console.log(
              `[useWorkflowRunRealtime] Finishing run with status: ${runStatus}`,
            );
            hasFinishedRef.current = true;
            executionStore.finishRun(runStatus as any);
            workflowEditorStore.setIsRunning(false, null);
          }
        }
      }
    } else {
      console.log("[useWorkflowRunRealtime] No metadata in run object");
    }

    // If run is terminal and we haven't finished yet, finish it now
    if (isTerminal && !hasFinishedRef.current) {
      console.log(
        `[useWorkflowRunRealtime] Run reached terminal state: ${run.status}`,
      );
      hasFinishedRef.current = true;
      const status =
        run.status === "COMPLETED"
          ? "success"
          : run.status === "FAILED"
            ? "failed"
            : "partial";
      console.log(
        `[useWorkflowRunRealtime] Finishing run with mapped status: ${status}`,
      );
      executionStore.finishRun(status as any);
      workflowEditorStore.setIsRunning(false, null);
    }
  }, [run, executionStore, workflowEditorStore]);
}
