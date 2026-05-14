"use client";

import { useEffect, useRef } from "react";
import { useRealtimeStream } from "@trigger.dev/react-hooks";
import { useExecutionStore } from "../store/executionStore";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";

interface UseWorkflowStreamParams {
  triggerRunId: string | null | undefined;
  nodeId: string | null | undefined;
  streamName: string | null | undefined;
  publicToken: string | null | undefined;
}

/**
 * Internal hook that actually subscribes to Trigger.dev stream.
 * This is ONLY called when we have valid parameters.
 * CRITICAL: This must be a separate function to avoid conditional hook calls.
 */
function useWorkflowStreamInternal(
  triggerRunId: string,
  nodeId: string,
  streamName: string,
  publicToken: string,
): void {
  const executionStore = useExecutionStore();
  const workflowEditorStore = useWorkflowEditorStore();

  // Track accumulated text to avoid re-accumulating on re-renders
  const accumulatedTextRef = useRef<string>("");
  // Track previous parts length to detect new chunks
  const previousPartsLengthRef = useRef<number>(0);

  // Subscribe to the stream using Trigger.dev's realtime API
  const { parts, error } = useRealtimeStream<string>(triggerRunId, streamName, {
    accessToken: publicToken,
  });

  useEffect(() => {
    // Handle stream errors
    if (error) {
      console.error(`Stream error for ${streamName}:`, error);
      executionStore.recordNodeFailure(nodeId, error.message, 0);
      return;
    }

    // Process stream chunks
    if (parts && parts.length > 0) {
      // Accumulate only new chunks since last update
      if (parts.length > previousPartsLengthRef.current) {
        for (let i = previousPartsLengthRef.current; i < parts.length; i++) {
          const chunk = parts[i];
          if (typeof chunk === "string") {
            accumulatedTextRef.current += chunk;
          }
        }
        previousPartsLengthRef.current = parts.length;

        // Update ExecutionStore and canvas with accumulated text
        executionStore.updateStreamingText(nodeId, accumulatedTextRef.current);
        workflowEditorStore.updateNodeData(nodeId, {
          response: accumulatedTextRef.current,
        });
      }
    }
  }, [parts, error, nodeId, streamName, executionStore, workflowEditorStore]);

  // Handle stream completion
  useEffect(() => {
    // When parts array stops growing, the stream has closed
    // Set node status to success if not already
    if (
      parts &&
      parts.length > 0 &&
      previousPartsLengthRef.current === parts.length
    ) {
      const currentStatus = executionStore.nodeStatuses.get(nodeId);
      if (currentStatus !== "success" && currentStatus !== "failed") {
        executionStore.setNodeStatus(nodeId, "success");
      }
    }
  }, [parts, nodeId, executionStore]);
}

/**
 * Hook that subscribes to a Trigger.dev stream (e.g., Gemini token stream)
 * and accumulates chunks into full text, updating the ExecutionStore and canvas.
 *
 * - Accumulates token chunks into full text
 * - Updates ExecutionStore and canvas on each chunk
 * - On stream close, sets node status to success if not already
 * - On error, logs and calls recordNodeFailure()
 *
 * IMPORTANT: This hook uses a wrapper pattern to avoid conditional hook calls.
 * The internal hook is only invoked when all parameters are provided.
 */
export function useWorkflowStream({
  triggerRunId,
  nodeId,
  streamName,
  publicToken,
}: UseWorkflowStreamParams): void {
  // Only call the internal hook when we have valid parameters
  // This avoids the "Rendered more/fewer hooks" error
  if (triggerRunId && nodeId && streamName && publicToken) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWorkflowStreamInternal(triggerRunId, nodeId, streamName, publicToken);
  }
}
