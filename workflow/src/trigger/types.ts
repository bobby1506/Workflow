// ─── Shared types for Trigger.dev task payloads ───────────────────────────────

export interface NodeTaskPayload {
  /** DB Run ID */
  runId: string;
  /** DB Workflow ID */
  workflowId: string;
  /** React Flow node ID */
  nodeId: string;
  /** Node type string */
  nodeType: string;
  /** Resolved inputs assembled by the orchestrator */
  inputs: Record<string, unknown>;
}

export interface NodeTaskResult {
  nodeId: string;
  output: Record<string, unknown>;
  durationMs: number;
}

export interface WorkflowTaskPayload {
  /** DB Run ID (already created) */
  runId: string;
  /** DB Workflow ID */
  workflowId: string;
  /** Serialized nodes JSON */
  nodes: unknown[];
  /** Serialized edges JSON */
  edges: unknown[];
  /** Execution scope */
  scope: "FULL" | "PARTIAL" | "SINGLE_NODE";
  /** Target node IDs for partial/single execution */
  targetNodeIds?: string[];
}
