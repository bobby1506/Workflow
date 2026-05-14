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
 * IMPORTANT: This hook only subscribes when both triggerRunId and publicToken are provided.
 * When either is missing, the hook is a no-op and makes no API calls.
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

  console.log("[useWorkflowRunRealtime] Hook called with:", {
    triggerRunId,
    publicToken,
  });

  // Subscribe to the run using Trigger.dev's realtime API
  // Pass undefined if parameters are invalid to avoid API calls
  const { run } = useRealtimeRun(
    triggerRunId && publicToken ? triggerRunId : undefined,
    {
      accessToken: publicToken ?? undefined,
    },
  );

  console.log("[useWorkflowRunRealtime] useRealtimeRun returned:", { run });

  useEffect(() => {
    // Skip if run data not available or parameters are invalid
    if (!run || !triggerRunId || !publicToken) {
      console.log("[useWorkflowRunRealtime] Skipping effect - missing data:", {
        run: !!run,
        triggerRunId: !!triggerRunId,
        publicToken: !!publicToken,
      });
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
      console.log("[useWorkflowRunRealtime] Processing metadata:", metadata);

      // Update individual node statuses and outputs
      const nodes = metadata.nodes as Record<string, unknown> | undefined;
      if (nodes && typeof nodes === "object") {
        console.log("[useWorkflowRunRealtime] Found nodes in metadata:", nodes);
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
  }, [run, triggerRunId, publicToken, executionStore, workflowEditorStore]);
}
