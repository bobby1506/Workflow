import type {
  Workflow,
  Run,
  NodeRun,
  RunStatus,
  RunScope,
  NodeRunStatus,
} from "@/generated/prisma/client";

// ─── Re-exports for convenience ───────────────────────────────────────────────
export type { Workflow, Run, NodeRun, RunStatus, RunScope, NodeRunStatus };

// ─── React Flow JSON shapes stored in Workflow.nodes / edges / viewport ───────
export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

// ─── Workflow update payload ───────────────────────────────────────────────────
export interface UpdateWorkflowData {
  name?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  viewport?: FlowViewport;
}

// ─── Lightweight workflow list item (API response shape) ──────────────────────
export interface WorkflowListItem {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  isTemplate: boolean;
  isReadonly: boolean;
  templateSourceId: string | null;
}
