import { nanoid } from "nanoid";
import { emit } from "../events/eventBus";
import type {
  ExecutionEvent,
  NodeQueuedEvent,
  NodeRunningEvent,
  NodeStreamingEvent,
  NodeCompletedEvent,
  NodeFailedEvent,
  NodeSkippedEvent,
  WorkflowStartedEvent,
  WorkflowCompletedEvent,
  WorkflowFailedEvent,
  StreamChunkEvent,
  StreamDoneEvent,
} from "../types";

function base(
  type: ExecutionEvent["type"],
  workflowId: string,
  runId: string,
): Pick<
  ExecutionEvent,
  "type" | "workflowId" | "runId" | "timestamp" | "eventId"
> {
  return {
    type,
    workflowId,
    runId,
    timestamp: Date.now(),
    eventId: nanoid(),
  };
}

export const executionEmitter = {
  workflowStarted(
    workflowId: string,
    runId: string,
    scope: WorkflowStartedEvent["scope"],
    nodeIds: string[],
  ) {
    emit(workflowId, {
      ...base("workflow.started", workflowId, runId),
      type: "workflow.started",
      scope,
      nodeIds,
    } as WorkflowStartedEvent);
  },

  workflowCompleted(
    workflowId: string,
    runId: string,
    status: WorkflowCompletedEvent["status"],
    durationMs: number,
  ) {
    emit(workflowId, {
      ...base("workflow.completed", workflowId, runId),
      type: "workflow.completed",
      status,
      durationMs,
    } as WorkflowCompletedEvent);
  },

  workflowFailed(
    workflowId: string,
    runId: string,
    error: string,
    durationMs: number,
  ) {
    emit(workflowId, {
      ...base("workflow.failed", workflowId, runId),
      type: "workflow.failed",
      error,
      durationMs,
    } as WorkflowFailedEvent);
  },

  nodeQueued(
    workflowId: string,
    runId: string,
    nodeId: string,
    nodeType: string,
  ) {
    emit(workflowId, {
      ...base("node.queued", workflowId, runId),
      type: "node.queued",
      nodeId,
      nodeType,
    } as NodeQueuedEvent);
  },

  nodeRunning(
    workflowId: string,
    runId: string,
    nodeId: string,
    nodeType: string,
    input: Record<string, unknown>,
  ) {
    emit(workflowId, {
      ...base("node.running", workflowId, runId),
      type: "node.running",
      nodeId,
      nodeType,
      input,
    } as NodeRunningEvent);
  },

  nodeStreaming(
    workflowId: string,
    runId: string,
    nodeId: string,
    partialResponse: string,
  ) {
    emit(workflowId, {
      ...base("node.streaming", workflowId, runId),
      type: "node.streaming",
      nodeId,
      partialResponse,
    } as NodeStreamingEvent);
  },

  nodeCompleted(
    workflowId: string,
    runId: string,
    nodeId: string,
    nodeType: string,
    output: Record<string, unknown>,
    durationMs: number,
  ) {
    emit(workflowId, {
      ...base("node.completed", workflowId, runId),
      type: "node.completed",
      nodeId,
      nodeType,
      output,
      durationMs,
    } as NodeCompletedEvent);
  },

  nodeFailed(
    workflowId: string,
    runId: string,
    nodeId: string,
    nodeType: string,
    error: string,
    durationMs: number,
  ) {
    emit(workflowId, {
      ...base("node.failed", workflowId, runId),
      type: "node.failed",
      nodeId,
      nodeType,
      error,
      durationMs,
    } as NodeFailedEvent);
  },

  nodeSkipped(workflowId: string, runId: string, nodeId: string) {
    emit(workflowId, {
      ...base("node.skipped", workflowId, runId),
      type: "node.skipped",
      nodeId,
    } as NodeSkippedEvent);
  },

  streamChunk(
    workflowId: string,
    runId: string,
    nodeId: string,
    chunk: string,
    accumulated: string,
  ) {
    emit(workflowId, {
      ...base("stream.chunk", workflowId, runId),
      type: "stream.chunk",
      nodeId,
      chunk,
      accumulated,
    } as StreamChunkEvent);
  },

  streamDone(
    workflowId: string,
    runId: string,
    nodeId: string,
    fullResponse: string,
  ) {
    emit(workflowId, {
      ...base("stream.done", workflowId, runId),
      type: "stream.done",
      nodeId,
      fullResponse,
    } as StreamDoneEvent);
  },
};
