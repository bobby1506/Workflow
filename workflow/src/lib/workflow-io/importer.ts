import { nanoid } from "nanoid";
import {
  EXPORT_FORMAT_VERSION,
  type WorkflowExportFormat,
  type ImportValidationResult,
} from "./types";

/**
 * Validates and parses a workflow JSON file.
 */
export function validateWorkflowImport(raw: unknown): ImportValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Invalid JSON: expected an object"] };
  }

  const data = raw as Record<string, unknown>;

  if (!data.version || typeof data.version !== "string") {
    errors.push("Missing or invalid 'version' field");
  }

  if (!data.metadata || typeof data.metadata !== "object") {
    errors.push("Missing 'metadata' field");
  } else {
    const meta = data.metadata as Record<string, unknown>;
    if (!meta.name || typeof meta.name !== "string") {
      errors.push("Missing workflow name in metadata");
    }
  }

  if (!data.graph || typeof data.graph !== "object") {
    errors.push("Missing 'graph' field");
  } else {
    const graph = data.graph as Record<string, unknown>;
    if (!Array.isArray(graph.nodes))
      errors.push("graph.nodes must be an array");
    if (!Array.isArray(graph.edges))
      errors.push("graph.edges must be an array");
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: data as unknown as WorkflowExportFormat,
  };
}

/**
 * Remaps all node and edge IDs to fresh values.
 * Preserves internal edge connections by updating source/target references.
 */
export function remapWorkflowIds(
  data: WorkflowExportFormat,
): WorkflowExportFormat {
  const nodes = data.graph.nodes as Array<Record<string, unknown>>;
  const edges = data.graph.edges as Array<Record<string, unknown>>;

  // Build old → new ID map
  const idMap = new Map<string, string>();
  for (const node of nodes) {
    const oldId = node.id as string;
    // Preserve special node IDs (request-inputs, response)
    if (oldId === "request-inputs" || oldId === "response") {
      idMap.set(oldId, oldId);
    } else {
      idMap.set(oldId, nanoid(8));
    }
  }

  // Remap nodes
  const remappedNodes = nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id as string) ?? nanoid(8),
  }));

  // Remap edges
  const remappedEdges = edges.map((edge) => ({
    ...edge,
    id: nanoid(8),
    source: idMap.get(edge.source as string) ?? (edge.source as string),
    target: idMap.get(edge.target as string) ?? (edge.target as string),
  }));

  return {
    ...data,
    graph: {
      ...data.graph,
      nodes: remappedNodes,
      edges: remappedEdges,
    },
  };
}

/**
 * Reads a File object and returns parsed JSON.
 */
export async function readWorkflowFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch {
        reject(new Error("Invalid JSON file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
