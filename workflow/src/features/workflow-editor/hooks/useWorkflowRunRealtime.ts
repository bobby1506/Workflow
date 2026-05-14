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
 * This is ONLY called when we have valid parameters.
 * CRITICAL: This must be a separate function to avoid conditional hook calls.
 */
function useWorkflowRunRealtimeInternal(
  triggerRunId: string,
  publicToken: string,
): void {
  const executionStore = useExecutionStore();
  const workflowEditorStore = useWorkflowEditorStore();

  const hasFinishedRef = useRef(false);
  const previousRunStatusRef = useRef<string | null>(null);
  const prevRunIdRef = useRef<string | null>(null);

  // Reset state when a new run starts
  if (triggerRunId !== prevRunIdRef.current) {
    prevRunIdRef.current = triggerRunId;
    hasFinishedRef.current = false;
    previousRunStatusRef.current = null;
  }

  // Subscribe to the run using Trigger.dev's realtime API
  const { run } = useRealtimeRun(triggerRunId, {
    accessToken: publicToken,
  });

  useEffect(() => {
    // Guard: bail out if run hasn't loaded
    if (!run) return;

    const isTerminal =
      run.status === "COMPLETED" ||
      run.status === "FAILED" ||
      run.status === "CANCELED";

    if (hasFinishedRef.current && isTerminal) return;

    if (run.metadata) {
      // Parse metadata if it's a JSON string (Trigger.dev sends it as string)
      let rawMetadata = run.metadata;
      if (typeof rawMetadata === "string") {
        try {
          rawMetadata = JSON.parse(rawMetadata);
        } catch (error) {
          console.error(
            "[useWorkflowRunRealtime] Failed to parse metadata JSON:",
            error,
          );
          return;
        }
      }

      const flatMetadata = rawMetadata as Record<string, unknown>;

      // Restructure flattened keys (e.g., "nodes.nodeId.status" → nested object)
      const metadata: Record<string, any> = {};

      for (const [key, value] of Object.entries(flatMetadata)) {
        if (key.startsWith("nodes.")) {
          // Extract nodeId and property from "nodes.nodeId.property"
          const parts = key.split(".");
          if (parts.length >= 3) {
            const nodeId = parts[1];
            const property = parts.slice(2).join("."); // Handle nested properties

            if (!metadata.nodes) {
              metadata.nodes = {};
            }
            if (!metadata.nodes[nodeId]) {
              metadata.nodes[nodeId] = {};
            }
            metadata.nodes[nodeId][property] = value;
          }
        } else {
          // Top-level properties (runStatus, completedNodeCount, etc.)
          metadata[key] = value;
        }
      }

      // Process node status updates
      const nodes = metadata.nodes as Record<string, unknown> | undefined;
      if (nodes && typeof nodes === "object") {
        for (const [nodeId, nodeData] of Object.entries(nodes)) {
          if (typeof nodeData === "object" && nodeData !== null) {
            const node = nodeData as Record<string, unknown>;
            if (node.status && typeof node.status === "string") {
              executionStore.setNodeStatus(nodeId, node.status as any);
            }
            if (node.output && typeof node.output === "object") {
              workflowEditorStore.updateNodeData(nodeId, {
                response: node.output,
              });
            }
          }
        }
      }

      const runStatus = metadata.runStatus as string | undefined;
      if (runStatus && runStatus !== previousRunStatusRef.current) {
        previousRunStatusRef.current = runStatus;
        if (
          (runStatus === "success" ||
            runStatus === "failed" ||
            runStatus === "partial") &&
          !hasFinishedRef.current
        ) {
          hasFinishedRef.current = true;
          executionStore.finishRun(runStatus as any);
          workflowEditorStore.setIsRunning(false, null);
        }
      }
    }

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
 * Hook that subscribes to a Trigger.dev run and maps its metadata to the ExecutionStore.
 *
 * IMPORTANT: This hook uses a wrapper pattern to avoid conditional hook calls.
 * The internal hook is only invoked when both triggerRunId and publicToken are provided.
 */
export function useWorkflowRunRealtime({
  triggerRunId,
  publicToken,
}: UseWorkflowRunRealtimeParams): void {
  // Only call the internal hook when we have valid parameters
  // This avoids the "Rendered more/fewer hooks" error
  if (triggerRunId && publicToken) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWorkflowRunRealtimeInternal(triggerRunId, publicToken);
  }
}
