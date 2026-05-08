// ─── Realtime event types ─────────────────────────────────────────────────────

export type ExecutionEventType =
  | "workflow.started"
  | "workflow.completed"
  | "workflow.failed"
  | "node.queued"
  | "node.running"
  | "node.streaming"
  | "node.completed"
  | "node.failed"
  | "node.skipped"
  | "stream.chunk"
  | "stream.done";

export interface BaseExecutionEvent {
  type: ExecutionEventType;
  workflowId: string;
  runId: string;
  timestamp: number;
  /** Deduplicate events with same id */
  eventId: string;
}

export interface WorkflowStartedEvent extends BaseExecutionEvent {
  type: "workflow.started";
  scope: "full" | "selected" | "single";
  nodeIds: string[];
}

export interface WorkflowCompletedEvent extends BaseExecutionEvent {
  type: "workflow.completed";
  status: "success" | "partial";
  durationMs: number;
}

export interface WorkflowFailedEvent extends BaseExecutionEvent {
  type: "workflow.failed";
  error: string;
  durationMs: number;
}

export interface NodeQueuedEvent extends BaseExecutionEvent {
  type: "node.queued";
  nodeId: string;
  nodeType: string;
}

export interface NodeRunningEvent extends BaseExecutionEvent {
  type: "node.running";
  nodeId: string;
  nodeType: string;
  input: Record<string, unknown>;
}

export interface NodeStreamingEvent extends BaseExecutionEvent {
  type: "node.streaming";
  nodeId: string;
  /** Partial accumulated text so far */
  partialResponse: string;
}

export interface NodeCompletedEvent extends BaseExecutionEvent {
  type: "node.completed";
  nodeId: string;
  nodeType: string;
  output: Record<string, unknown>;
  durationMs: number;
}

export interface NodeFailedEvent extends BaseExecutionEvent {
  type: "node.failed";
  nodeId: string;
  nodeType: string;
  error: string;
  durationMs: number;
}

export interface NodeSkippedEvent extends BaseExecutionEvent {
  type: "node.skipped";
  nodeId: string;
}

export interface StreamChunkEvent extends BaseExecutionEvent {
  type: "stream.chunk";
  nodeId: string;
  chunk: string;
  accumulated: string;
}

export interface StreamDoneEvent extends BaseExecutionEvent {
  type: "stream.done";
  nodeId: string;
  fullResponse: string;
}

export type ExecutionEvent =
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | NodeQueuedEvent
  | NodeRunningEvent
  | NodeStreamingEvent
  | NodeCompletedEvent
  | NodeFailedEvent
  | NodeSkippedEvent
  | StreamChunkEvent
  | StreamDoneEvent;

// ─── SSE message shape ────────────────────────────────────────────────────────

export interface SSEMessage {
  data: ExecutionEvent;
}

// ─── Subscription options ─────────────────────────────────────────────────────

export interface SubscriptionOptions {
  workflowId: string;
  runId?: string;
  onEvent: (event: ExecutionEvent) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}
