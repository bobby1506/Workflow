import type { WorkflowNode, WorkflowEdge } from "../types";

// ─── Compiled DAG types ───────────────────────────────────────────────────────

export interface CompiledNode {
  id: string;
  type: string;
  /** IDs of nodes this node directly depends on */
  upstreamIds: string[];
  /** IDs of nodes that depend on this node */
  downstreamIds: string[];
  /** Edges coming INTO this node */
  incomingEdges: WorkflowEdge[];
  /** Edges going OUT of this node */
  outgoingEdges: WorkflowEdge[];
}

export interface CompiledDAG {
  nodes: Map<string, CompiledNode>;
  /** Topological order (root → leaf) */
  executionOrder: string[];
  /** Nodes with no upstream dependencies */
  roots: string[];
  /** Edges that were filtered out due to missing nodes */
  removedEdges: WorkflowEdge[];
}

export interface DAGValidationError {
  type: "cycle" | "missing_node" | "empty";
  message: string;
}

// ─── Cycle detection (DFS) ────────────────────────────────────────────────────

function hasCycle(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    visited.add(id);
    inStack.add(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }
    inStack.delete(id);
    return false;
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      if (dfs(id)) return true;
    }
  }
  return false;
}

// ─── Topological sort (Kahn's algorithm) ─────────────────────────────────────

function topologicalSort(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
  inDegree: Map<string, number>,
): string[] {
  const queue: string[] = [];
  const result: string[] = [];
  const degree = new Map(inDegree);

  for (const id of nodeIds) {
    if ((degree.get(id) ?? 0) === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const d = (degree.get(neighbor) ?? 1) - 1;
      degree.set(neighbor, d);
      if (d === 0) queue.push(neighbor);
    }
  }

  return result;
}

// ─── DAG Compiler ─────────────────────────────────────────────────────────────

export function compileDAG(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { dag: CompiledDAG | null; error: DAGValidationError | null } {
  if (!nodes || nodes.length === 0) {
    return {
      dag: null,
      error: { type: "empty", message: "Workflow has no nodes" },
    };
  }

  const nodeIds = nodes.map((n) => n.id);
  const nodeSet = new Set(nodeIds);

  // Filter out invalid edges (edges pointing to non-existent nodes)
  // This prevents workflow corruption from blocking execution
  const removedEdges: WorkflowEdge[] = [];
  const validEdges = edges.filter((edge) => {
    const isValid = nodeSet.has(edge.source) && nodeSet.has(edge.target);
    if (!isValid) {
      removedEdges.push(edge);
      console.warn(
        `[DAG] Removing invalid edge: ${edge.source} → ${edge.target} (node does not exist)`,
      );
    }
    return isValid;
  });

  // Build adjacency list (source → targets) and in-degree map
  const adjacency = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>(); // target → sources
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    reverseAdj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of validEdges) {
    adjacency.get(edge.source)!.push(edge.target);
    reverseAdj.get(edge.target)!.push(edge.source);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Cycle check
  if (hasCycle(nodeIds, adjacency)) {
    return {
      dag: null,
      error: { type: "cycle", message: "Workflow contains a cycle" },
    };
  }

  // Topological sort
  const executionOrder = topologicalSort(nodeIds, adjacency, inDegree);

  // Build compiled node map
  const compiledNodes = new Map<string, CompiledNode>();
  for (const node of nodes) {
    compiledNodes.set(node.id, {
      id: node.id,
      type: node.type ?? "unknown",
      upstreamIds: reverseAdj.get(node.id) ?? [],
      downstreamIds: adjacency.get(node.id) ?? [],
      incomingEdges: validEdges.filter((e) => e.target === node.id),
      outgoingEdges: validEdges.filter((e) => e.source === node.id),
    });
  }

  const roots = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);

  return {
    dag: { nodes: compiledNodes, executionOrder, roots, removedEdges },
    error: null,
  };
}

// ─── Compute minimal subgraph for partial execution ───────────────────────────

/**
 * Given a set of target node IDs, compute the minimal set of nodes
 * that must execute (including all upstream dependencies).
 */
export function computeExecutionSubgraph(
  targetIds: string[],
  dag: CompiledDAG,
): Set<string> {
  const required = new Set<string>();

  function collectUpstream(id: string) {
    if (required.has(id)) return;
    required.add(id);
    const node = dag.nodes.get(id);
    if (!node) return;
    for (const upId of node.upstreamIds) {
      collectUpstream(upId);
    }
  }

  for (const id of targetIds) {
    collectUpstream(id);
  }

  return required;
}
