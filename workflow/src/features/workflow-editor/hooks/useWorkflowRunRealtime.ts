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
  const setNodeStatus = useExecutionStore((s) => s.setNodeStatus);
  const finishRun = useExecutionStore((s) => s.finishRun);
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData);
  const setIsRunning = useWorkflowEditorStore((s) => s.setIsRunning);

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
              setNodeStatus(nodeId, node.status as any);
            }
            if (node.output && typeof node.output === "object") {
              const outputs = node.output as Record<string, any>;
              const patch: Record<string, any> = {};

              // Map common output fields to their respective node data properties
              if (outputs.response) patch.response = outputs.response;
              if (outputs.outputImageUrl)
                patch.outputImageUrl = outputs.outputImageUrl;
              if (outputs.result) patch.result = outputs.result;

              // If no recognized keys found, merge the entire output as a fallback
              if (Object.keys(patch).length === 0) {
                Object.assign(patch, outputs);
              }

              updateNodeData(nodeId, patch);
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
          finishRun(runStatus as any);
          setIsRunning(false, null);
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
      finishRun(status as any);
      setIsRunning(false, null);
    }
  }, [
    run,
    triggerRunId,
    publicToken,
    setNodeStatus,
    finishRun,
    updateNodeData,
    setIsRunning,
  ]);
}
