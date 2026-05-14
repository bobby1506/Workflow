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
 * Hook that subscribes to a Trigger.dev stream (e.g., Gemini token stream)
 * and accumulates chunks into full text, updating the ExecutionStore and canvas.
 *
 * - Accumulates token chunks into full text
 * - Updates ExecutionStore and canvas on each chunk
 * - On stream close, sets node status to success if not already
 * - On error, logs and calls recordNodeFailure()
 */
export function useWorkflowStream({
  triggerRunId,
  nodeId,
  streamName,
  publicToken,
}: UseWorkflowStreamParams): void {
  const executionStore = useExecutionStore();
  const workflowEditorStore = useWorkflowEditorStore();

  // Track accumulated text to avoid re-accumulating on re-renders
  const accumulatedTextRef = useRef<string>("");
  // Track previous parts length to detect new chunks
  const previousPartsLengthRef = useRef<number>(0);

  // Always call the hook — never conditionally
  const { parts, error } = useRealtimeStream<string>(
    triggerRunId ?? "",
    streamName ?? "",
    {
      accessToken: publicToken ?? "",
      enabled: !!(triggerRunId && nodeId && streamName && publicToken),
    },
  );

  useEffect(() => {
    // Guard: bail out if params aren't ready
    if (!triggerRunId || !nodeId || !streamName || !publicToken) return;

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
  }, [
    parts,
    error,
    nodeId,
    streamName,
    triggerRunId,
    publicToken,
    executionStore,
    workflowEditorStore,
  ]);

  // Handle stream completion
  useEffect(() => {
    // Guard: bail out if params aren't ready
    if (!triggerRunId || !nodeId || !streamName || !publicToken) return;

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
  }, [parts, nodeId, streamName, triggerRunId, publicToken, executionStore]);
}
