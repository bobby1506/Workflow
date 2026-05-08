"use client";

import { useCallback } from "react";
import { useExecutionStore } from "../store/executionStore";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { useExecutionEvents } from "@/lib/realtime/hooks/useExecutionEvents";
import type { ExecutionEvent } from "@/lib/realtime/types";

export function useRealtimeExecution() {
  const workflowId = useWorkflowEditorStore((s) => s.workflowId);
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData);
  const setIsRunning = useWorkflowEditorStore((s) => s.setIsRunning);

  const handleEvent = useCallback(
    (event: ExecutionEvent) => {
      // Always get fresh store references — avoids stale closure bugs
      const es = useExecutionStore.getState();


      switch (event.type) {
        case "workflow.started":
          setIsRunning(true, event.scope);
          break;

        case "node.queued":
          es.setNodeStatus(event.nodeId, "queued");
          break;

        case "node.running":
          es.setNodeStatus(event.nodeId, "running");
          es.recordNodeStart(event.nodeId, event.nodeType, event.input);
          break;

        case "node.streaming":
          es.updateStreamingText(event.nodeId, event.partialResponse);
          updateNodeData(event.nodeId, { response: event.partialResponse });
          break;

        case "stream.chunk":
          es.updateStreamingText(event.nodeId, event.accumulated);
          updateNodeData(event.nodeId, { response: event.accumulated });
          break;

        case "stream.done":
          es.updateStreamingText(event.nodeId, event.fullResponse);
          updateNodeData(event.nodeId, { response: event.fullResponse });
          break;

        case "node.completed": {
          es.recordNodeSuccess(event.nodeId, event.output, event.durationMs);
          const output = event.output;
          if (output.response) {
            updateNodeData(event.nodeId, { response: output.response });
          }
          if (output.outputImageUrl) {
            updateNodeData(event.nodeId, {
              outputImageUrl: output.outputImageUrl,
            });
          }
          if (output["output-image"]) {
            updateNodeData(event.nodeId, {
              outputImageUrl: output["output-image"],
            });
          }
          if (output.result) {
            updateNodeData(event.nodeId, { result: output.result });
          }
          break;
        }

        case "node.failed":
          es.recordNodeFailure(event.nodeId, event.error, event.durationMs);
          console.error(
            `[NextFlow SSE] ❌ Node failed: ${event.nodeId}`,
            event.error,
          );
          break;

        case "node.skipped":
          es.setNodeStatus(event.nodeId, "skipped");
          break;

        case "workflow.completed":
          es.finishRun(event.status);
          setIsRunning(false, null);
          break;

        case "workflow.failed":
          es.finishRun("failed");
          setIsRunning(false, null);
          console.error(`[NextFlow SSE] ❌ Workflow failed`);
          break;
      }
    },
    [updateNodeData, setIsRunning],
  );

  useExecutionEvents({
    workflowId,
    onEvent: handleEvent,
  });
}
