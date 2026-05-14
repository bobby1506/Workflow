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
 * Internal hook that actually subscribes to Trigger.dev realtime.
 * This is only called when we have valid parameters.
 */
function useExecutionProgressInternal(
  triggerRunId: string,
  publicToken: string,
): ExecutionProgress {
  // Subscribe to the run using Trigger.dev's realtime API
  const { run } = useRealtimeRun(triggerRunId, {
    accessToken: publicToken,
  });

  // Compute progress from metadata
  const progress = useMemo<ExecutionProgress>(() => {
    if (!run || !run.metadata) {
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
  }, [run]);

  return progress;
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
 *
 * IMPORTANT: This hook only subscribes when both triggerRunId and publicToken are provided.
 * When either is missing, the hook is a no-op and makes no API calls.
 */
export function useExecutionProgress({
  triggerRunId,
  publicToken,
}: UseExecutionProgressParams): ExecutionProgress {
  // Only call the internal hook when we have valid parameters
  if (triggerRunId && publicToken) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useExecutionProgressInternal(triggerRunId, publicToken);
  }

  // Return default when parameters are missing
  return {
    completedNodeCount: 0,
    totalNodeCount: 0,
    percentage: 0,
  };
}
