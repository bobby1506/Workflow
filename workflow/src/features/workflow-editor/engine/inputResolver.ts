import type { WorkflowNode, WorkflowEdge, InputField } from "../types";
import type { CompiledNode } from "./dagCompiler";

// ─── Resolved input payload ───────────────────────────────────────────────────

export type ResolvedInputs = Record<string, unknown>;

// ─── Node output registry (populated as nodes complete) ──────────────────────

export type NodeOutputRegistry = Map<string, Record<string, unknown>>;

/**
 * Resolve all inputs for a node before execution.
 *
 * Priority:
 * 1. If a handle has an incoming edge → use the upstream node's output value
 * 2. Otherwise → use the manual value from node.data
 */
export function resolveNodeInputs(
  nodeId: string,
  nodes: WorkflowNode[],
  compiledNode: CompiledNode,
  outputRegistry: NodeOutputRegistry,
): ResolvedInputs {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return {};

  const resolved: ResolvedInputs = {};

  // Build a map of targetHandle → upstream output value
  const connectedValues = new Map<string, unknown>();
  for (const edge of compiledNode.incomingEdges) {
    const upstreamOutput = outputRegistry.get(edge.source);
    if (!upstreamOutput) continue;

    const sourceHandle = edge.sourceHandle ?? "output";
    const targetHandle = edge.targetHandle ?? "input";

    // The upstream node exposes its output keyed by sourceHandle
    const value = upstreamOutput[sourceHandle] ?? upstreamOutput["output"];
    connectedValues.set(targetHandle, value);
  }

  const data = node.data as Record<string, unknown>;

  switch (node.type) {
    case "request-inputs": {
      const fields = (data.fields as InputField[]) ?? [];
      for (const field of fields) {
        if (field.type === "image") {
          resolved[field.id] = field.asset?.url ?? null;
        } else {
          resolved[field.id] = field.value ?? "";
        }
      }
      break;
    }

    case "gemini": {
      resolved.prompt = connectedValues.get("prompt") ?? data.prompt ?? "";
      resolved.systemPrompt =
        connectedValues.get("system-prompt") ?? data.systemPrompt ?? "";
      resolved.model = data.model ?? "gemini-2.5-flash";
      resolved.settings = data.settings ?? {};

      // Image vision — can have multiple connections
      const imageVisionConnected = connectedValues.get("image-vision");
      if (imageVisionConnected) {
        // Collect all image-vision edges (multi-image support)
        const imageValues = compiledNode.incomingEdges
          .filter((e) => e.targetHandle === "image-vision")
          .map((e) => {
            const upOut = outputRegistry.get(e.source);
            return upOut?.[e.sourceHandle ?? "output"] ?? null;
          })
          .filter(Boolean);
        resolved.images = imageValues;
      } else {
        // Support both imageAssets (array) and imageAsset (single, legacy)
        const imageAssets = data.imageAssets as { url: string }[] | undefined;
        const imageAsset = data.imageAsset as { url?: string } | null;
        if (imageAssets && imageAssets.length > 0) {
          resolved.images = imageAssets.map((a) => a.url).filter(Boolean);
        } else if (imageAsset?.url) {
          resolved.images = [imageAsset.url];
        } else {
          resolved.images = [];
        }
      }

      resolved.videoUrl =
        connectedValues.get("video") ??
        (data.videoAsset as { url?: string } | null)?.url ??
        null;
      resolved.audioUrl =
        connectedValues.get("audio") ??
        (data.audioAsset as { url?: string } | null)?.url ??
        null;
      resolved.fileUrl =
        connectedValues.get("file") ??
        (data.fileAsset as { url?: string } | null)?.url ??
        null;
      break;
    }

    case "crop-image": {
      resolved.imageUrl =
        connectedValues.get("input-image") ??
        (data.imageAsset as { url?: string } | null)?.url ??
        null;
      resolved.x = connectedValues.get("param-x") ?? data.x ?? 0;
      resolved.y = connectedValues.get("param-y") ?? data.y ?? 0;
      resolved.width = connectedValues.get("param-width") ?? data.width ?? 100;
      resolved.height =
        connectedValues.get("param-height") ?? data.height ?? 100;
      break;
    }

    case "response": {
      // Collect all incoming values
      const resultValue = connectedValues.get("result");
      resolved.result = resultValue ?? null;
      break;
    }

    default:
      break;
  }

  return resolved;
}
