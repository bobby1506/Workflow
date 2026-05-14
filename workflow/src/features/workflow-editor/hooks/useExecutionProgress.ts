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

/**
 * Hook that derives progress bar data from run metadata.
 *
 * Returns:
 * - completedNodeCount: Number of nodes that have completed
 * - totalNodeCount: Total number of nodes in the workflow
 * - percentage: Completion percentage (0-100)
 *
 * Returns { completedNodeCount: 0, totalNodeCount: 0, percentage: 0 } if params missing.
 */
export function useExecutionProgress({
  triggerRunId,
  publicToken,
}: UseExecutionProgressParams): ExecutionProgress {
  // Always call the hook — never conditionally
  const { run } = useRealtimeRun(triggerRunId ?? "", {
    accessToken: publicToken ?? "",
    enabled: !!(triggerRunId && publicToken),
  });

  // Compute progress from metadata
  const progress = useMemo<ExecutionProgress>(() => {
    // Guard: bail out if params aren't ready or run hasn't loaded
    if (!triggerRunId || !publicToken || !run || !run.metadata) {
      return {
        completedNodeCount: 0,
        totalNodeCount: 0,
        percentage: 0,
      };
    }

    // Parse metadata if it's a JSON string (Trigger.dev sends it as string)
    let rawMetadata = run.metadata;
    if (typeof rawMetadata === "string") {
      try {
        rawMetadata = JSON.parse(rawMetadata);
      } catch (error) {
        console.error(
          "[useExecutionProgress] Failed to parse metadata JSON:",
          error,
        );
        return {
          completedNodeCount: 0,
          totalNodeCount: 0,
          percentage: 0,
        };
      }
    }

    const metadata = rawMetadata as Record<string, unknown>;
    const completedNodeCount = (metadata.completedNodeCount as number) || 0;
    const totalNodeCount = (metadata.totalNodeCount as number) || 0;

    // Compute percentage, avoiding division by zero
    let percentage = 0;
    if (totalNodeCount > 0) {
      percentage = Math.round((completedNodeCount / totalNodeCount) * 100);
    }

    return {
      completedNodeCount,
      totalNodeCount,
      percentage,
    };
  }, [run, triggerRunId, publicToken]);

  return progress;
}
