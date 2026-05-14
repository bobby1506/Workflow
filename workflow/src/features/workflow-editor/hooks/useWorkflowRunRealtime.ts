"use client";

import { useEffect, useRef } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useExecutionStore } from "../store/executionStore";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";

interface UseWorkflowRunRealtimeParams {
  triggerRunId: string | null | undefined;
  publicToken: string | null | undefined;
}

export function useWorkflowRunRealtime({
  triggerRunId,
  publicToken,
}: UseWorkflowRunRealtimeParams): void {
  const executionStore = useExecutionStore();
  const workflowEditorStore = useWorkflowEditorStore();

  const hasFinishedRef = useRef(false);
  const previousRunStatusRef = useRef<string | null>(null);
  const prevRunIdRef = useRef<string | null>(null);

  if (triggerRunId !== prevRunIdRef.current) {
    prevRunIdRef.current = triggerRunId ?? null;
    hasFinishedRef.current = false;
    previousRunStatusRef.current = null;
  }

  // Always call — never conditionally
  const { run } = useRealtimeRun(triggerRunId ?? "", {
    accessToken: publicToken ?? "",
    enabled: !!(triggerRunId && publicToken),
  });

  useEffect(() => {
    if (!triggerRunId || !publicToken || !run) return;

    const isTerminal =
      run.status === "COMPLETED" ||
      run.status === "FAILED" ||
      run.status === "CANCELED";

    if (hasFinishedRef.current && isTerminal) return;

    if (run.metadata) {
      let rawMetadata = run.metadata;
      if (typeof rawMetadata === "string") {
        try {
          rawMetadata = JSON.parse(rawMetadata);
        } catch (error) {
          console.error(
            "[useWorkflowRunRealtime] Failed to parse metadata JSON:",
            error,
          );
          return;
        }
      }

      const flatMetadata = rawMetadata as Record<string, unknown>;
      const metadata: Record<string, any> = {};

      for (const [key, value] of Object.entries(flatMetadata)) {
        if (key.startsWith("nodes.")) {
          const parts = key.split(".");
          if (parts.length >= 3) {
            const nodeId = parts[1];
            const property = parts.slice(2).join(".");
            if (!metadata.nodes) metadata.nodes = {};
            if (!metadata.nodes[nodeId]) metadata.nodes[nodeId] = {};
            metadata.nodes[nodeId][property] = value;
          }
        } else {
          metadata[key] = value;
        }
      }

      const nodes = metadata.nodes as Record<string, unknown> | undefined;
      if (nodes && typeof nodes === "object") {
        for (const [nodeId, nodeData] of Object.entries(nodes)) {
          if (typeof nodeData === "object" && nodeData !== null) {
            const node = nodeData as Record<string, unknown>;
            if (node.status && typeof node.status === "string") {
              executionStore.setNodeStatus(nodeId, node.status as any);
            }
            if (node.output && typeof node.output === "object") {
              workflowEditorStore.updateNodeData(nodeId, {
                response: node.output,
              });
            }
          }
        }
      }

      const runStatus = metadata.runStatus as string | undefined;
      if (runStatus && runStatus !== previousRunStatusRef.current) {
        previousRunStatusRef.current = runStatus;
        if (
          (runStatus === "success" ||
            runStatus === "failed" ||
            runStatus === "partial") &&
          !hasFinishedRef.current
        ) {
          hasFinishedRef.current = true;
          executionStore.finishRun(runStatus as any);
          workflowEditorStore.setIsRunning(false, null);
        }
      }
    }

    if (isTerminal && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      const status =
        run.status === "COMPLETED"
          ? "success"
          : run.status === "FAILED"
            ? "failed"
            : "partial";
      executionStore.finishRun(status as any);
      workflowEditorStore.setIsRunning(false, null);
    }
  }, [run, triggerRunId, publicToken, executionStore, workflowEditorStore]);
}
