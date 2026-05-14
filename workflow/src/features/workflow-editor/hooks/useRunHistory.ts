"use client";

import { useState, useEffect, useCallback } from "react";

// ─── DB run shape (from API) ──────────────────────────────────────────────────

export interface DbNodeRun {
  id: string;
  nodeId: string;
  nodeType: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  duration: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface DbRun {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
  scope: "FULL" | "PARTIAL" | "SINGLE_NODE";
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  nodeRuns: DbNodeRun[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRunHistory(workflowId: string) {
  const [runs, setRuns] = useState<DbRun[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRuns = useCallback(async () => {
    if (!workflowId) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
      }
    } catch {
      // Non-critical
    }
  }, [workflowId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchRuns().finally(() => setLoading(false));
  }, [fetchRuns]);

  return { runs, loading, refetch: fetchRuns };
}
