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
 * Internal hook that actually subscribes to Trigger.dev realtime.
 * This is only called when we have valid parameters.
 */
function useWorkflowRunRealtimeInternal(
  triggerRunId: string,
  publicToken: string,
): void {
  const executionStore = useExecutionStore();
  const workflowEditorStore = useWorkflowEditorStore();

  // Track whether we've already finished the run to avoid duplicate cleanup
  const hasFinishedRef = useRef(false);
  // Track the previous runStatus to detect transitions
  const previousRunStatusRef = useRef<string | null>(null);

  // Subscribe to the run using Trigger.dev's realtime API
  const { run } = useRealtimeRun(triggerRunId, {
    accessToken: publicToken,
  });

  useEffect(() => {
    // Skip if run data not available
    if (!run) {
      return;
    }

    // Check if run has reached a terminal state
    const isTerminal =
      run.status === "COMPLETED" ||
      run.status === "FAILED" ||
      run.status === "CANCELED";

    // If we've already finished this run, ignore further updates
    if (hasFinishedRef.current && isTerminal) {
      return;
    }

    // Process metadata updates
    if (run.metadata) {
      const metadata = run.metadata as Record<string, unknown>;

      // Update individual node statuses and outputs
      const nodes = metadata.nodes as Record<string, unknown> | undefined;
      if (nodes && typeof nodes === "object") {
        for (const [nodeId, nodeData] of Object.entries(nodes)) {
          if (typeof nodeData === "object" && nodeData !== null) {
            const node = nodeData as Record<string, unknown>;

            // Update node status
            if (node.status && typeof node.status === "string") {
              executionStore.setNodeStatus(nodeId, node.status as any);
            }

            // Update node output/data
            if (node.output && typeof node.output === "object") {
              workflowEditorStore.updateNodeData(nodeId, {
                response: node.output,
              });
            }
          }
        }
      }

      // Handle runStatus transitions
      const runStatus = metadata.runStatus as string | undefined;
      if (runStatus && runStatus !== previousRunStatusRef.current) {
        previousRunStatusRef.current = runStatus;

        // Map Trigger.dev runStatus to ExecutionStore status
        if (
          runStatus === "success" ||
          runStatus === "failed" ||
          runStatus === "partial"
        ) {
          if (!hasFinishedRef.current) {
            hasFinishedRef.current = true;
            executionStore.finishRun(runStatus as any);
            workflowEditorStore.setIsRunning(false, null);
          }
        }
      }
    }

    // If run is terminal and we haven't finished yet, finish it now
    if (isTerminal && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      const status =
        run.status === "COMPLETED"
          ? "success"
          : run.status === "FAILED"
            ? "failed"
            : "partial";
      executionStore.finishRun(status as any);
      workflowEditorStore.setIsRunning(false, null);
    }
  }, [run, executionStore, workflowEditorStore]);
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
  // Only call the internal hook when we have valid parameters
  if (triggerRunId && publicToken) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWorkflowRunRealtimeInternal(triggerRunId, publicToken);
  }
}
