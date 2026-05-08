import { EXPORT_FORMAT_VERSION, type WorkflowExportFormat } from "./types";

/**
 * Builds a portable JSON export of a workflow.
 */
export function buildWorkflowExport(workflow: {
  name: string;
  nodes: unknown;
  edges: unknown;
  viewport: unknown;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowExportFormat {
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    metadata: {
      name: workflow.name,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    },
    graph: {
      nodes: (workflow.nodes as unknown[]) ?? [],
      edges: (workflow.edges as unknown[]) ?? [],
      viewport: (workflow.viewport as {
        x: number;
        y: number;
        zoom: number;
      }) ?? {
        x: 0,
        y: 0,
        zoom: 1,
      },
    },
  };
}

/**
 * Triggers a browser download of the workflow JSON.
 */
export function downloadWorkflowJSON(
  data: WorkflowExportFormat,
  filename: string,
): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9-_]/gi, "_")}.nextflow.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
