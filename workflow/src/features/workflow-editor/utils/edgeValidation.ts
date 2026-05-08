import type { Connection, Node } from "@xyflow/react";
import { HandleDataType } from "../types";

// ─── Cycle detection via DFS ──────────────────────────────────────────────────

function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  nodes: Node[],
  edges: { source: string; target: string }[],
): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const neighbors = adj.get(edge.source);
    if (neighbors) neighbors.push(edge.target);
  }
  const sourceNeighbors = adj.get(sourceId);
  if (sourceNeighbors) sourceNeighbors.push(targetId);

  const visited = new Set<string>();
  const stack: string[] = [targetId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  return false;
}

// ─── Handle type extraction ───────────────────────────────────────────────────

export function getHandleDataType(
  handleId: string | null | undefined,
): HandleDataType {
  if (!handleId) return HandleDataType.GENERIC;
  if (handleId.includes("image")) return HandleDataType.IMAGE;
  if (handleId.includes("video")) return HandleDataType.VIDEO;
  if (handleId.includes("audio")) return HandleDataType.AUDIO;
  if (handleId.includes("file")) return HandleDataType.FILE;
  if (
    handleId.includes("text") ||
    handleId.includes("prompt") ||
    handleId.includes("response") ||
    handleId.includes("system")
  )
    return HandleDataType.TEXT;
  return HandleDataType.GENERIC;
}

// ─── Main validation function ─────────────────────────────────────────────────

export function isValidConnection(
  connection: Connection,
  nodes: Node[],
  edges: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }[],
): boolean {
  const { source, target, sourceHandle, targetHandle } = connection;

  if (!source || !target) return false;
  if (source === target) return false;

  if (wouldCreateCycle(source, target, nodes, edges)) return false;

  const sourceType = getHandleDataType(sourceHandle);
  const targetType = getHandleDataType(targetHandle);

  // Generic connects to anything
  if (
    sourceType === HandleDataType.GENERIC ||
    targetType === HandleDataType.GENERIC
  )
    return true;

  return sourceType === targetType;
}
