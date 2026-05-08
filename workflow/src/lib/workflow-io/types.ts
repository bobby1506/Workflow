// ─── Workflow export/import format ───────────────────────────────────────────

export const EXPORT_FORMAT_VERSION = "1.0.0";

export interface WorkflowExportFormat {
  /** Format version for future compatibility */
  version: string;
  exportedAt: string;
  metadata: {
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  };
  graph: {
    nodes: unknown[];
    edges: unknown[];
    viewport: { x: number; y: number; zoom: number };
  };
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  data?: WorkflowExportFormat;
}
