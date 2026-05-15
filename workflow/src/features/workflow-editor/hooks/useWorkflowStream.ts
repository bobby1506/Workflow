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

export function useWorkflowStream({
  triggerRunId,
  nodeId,
  streamName,
  publicToken,
}: UseWorkflowStreamParams): void {
  const recordNodeFailure = useExecutionStore((s) => s.recordNodeFailure);
  const updateStreamingText = useExecutionStore((s) => s.updateStreamingText);
  const setNodeStatus = useExecutionStore((s) => s.setNodeStatus);
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData);

  const accumulatedTextRef = useRef<string>("");
  const previousPartsLengthRef = useRef<number>(0);

  // Always call — never conditionally
  const { parts, error } = useRealtimeStream<string>(
    triggerRunId ?? "",
    streamName ?? "",
    {
      accessToken: publicToken ?? "",
      enabled: !!(triggerRunId && nodeId && streamName && publicToken),
    },
  );

  useEffect(() => {
    if (!triggerRunId || !nodeId || !streamName || !publicToken) return;

    if (error) {
      console.error(`Stream error for ${streamName}:`, error);
      recordNodeFailure(nodeId, error.message, 0);
      return;
    }

    if (parts && parts.length > previousPartsLengthRef.current) {
      for (let i = previousPartsLengthRef.current; i < parts.length; i++) {
        const chunk = parts[i];
        if (typeof chunk === "string") {
          accumulatedTextRef.current += chunk;
        }
      }
      previousPartsLengthRef.current = parts.length;
      updateStreamingText(nodeId, accumulatedTextRef.current);
      updateNodeData(nodeId, {
        response: accumulatedTextRef.current,
      });
    }
  }, [
    parts,
    error,
    nodeId,
    streamName,
    triggerRunId,
    publicToken,
    recordNodeFailure,
    updateStreamingText,
    updateNodeData,
  ]);

  useEffect(() => {
    if (!triggerRunId || !nodeId || !streamName || !publicToken) return;

    if (
      parts &&
      parts.length > 0 &&
      previousPartsLengthRef.current === parts.length
    ) {
      const currentStatus = useExecutionStore.getState().nodeStatuses.get(nodeId);
      if (currentStatus !== "success" && currentStatus !== "failed") {
        setNodeStatus(nodeId, "success");
      }
    }
  }, [parts, nodeId, streamName, triggerRunId, publicToken, setNodeStatus]);
}
