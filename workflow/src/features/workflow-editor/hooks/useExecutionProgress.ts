"use client";

import { useMemo } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

interface ExecutionProgress {
  completedNodeCount: number;
  totalNodeCount: number;
  percentage: number;
}

interface UseExecutionProgressParams {
  triggerRunId: string | null | undefined;
  publicToken: string | null | undefined;
}

export function useExecutionProgress({
  triggerRunId,
  publicToken,
}: UseExecutionProgressParams): ExecutionProgress {
  const empty = { completedNodeCount: 0, totalNodeCount: 0, percentage: 0 };

  const { run } = useRealtimeRun(triggerRunId ?? "", {
    accessToken: publicToken ?? "",
    enabled: !!(triggerRunId && publicToken),
  });

  return useMemo<ExecutionProgress>(() => {
    if (!triggerRunId || !publicToken || !run?.metadata) return empty;

    let rawMetadata = run.metadata;
    if (typeof rawMetadata === "string") {
      try {
        rawMetadata = JSON.parse(rawMetadata);
      } catch {
        return empty;
      }
    }

    const metadata = rawMetadata as Record<string, unknown>;
    const completedNodeCount = (metadata.completedNodeCount as number) || 0;
    const totalNodeCount = (metadata.totalNodeCount as number) || 0;
    const percentage =
      totalNodeCount > 0
        ? Math.round((completedNodeCount / totalNodeCount) * 100)
        : 0;

    return { completedNodeCount, totalNodeCount, percentage };
  }, [run, triggerRunId, publicToken]);
}
