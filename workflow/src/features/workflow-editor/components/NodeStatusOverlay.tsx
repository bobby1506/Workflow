"use client";

import type { RuntimeNodeStatus } from "../store/executionStore";

/**
 * Returns inline styles for a node based on its execution status.
 * Applied to the node's root wrapper div.
 */
export function nodeStatusStyle(
  status: RuntimeNodeStatus,
): React.CSSProperties {
  switch (status) {
    case "running":
      return {
        boxShadow:
          "0 0 0 2px #6366f1, 0 0 0 5px rgba(99,102,241,0.25), 0 0 20px rgba(99,102,241,0.2)",
        transition: "box-shadow 0.3s ease",
        animation: "nextflow-pulse-glow 1.5s ease-in-out infinite",
      };
    case "streaming":
      return {
        boxShadow:
          "0 0 0 2px #8b5cf6, 0 0 0 5px rgba(139,92,246,0.3), 0 0 24px rgba(139,92,246,0.25)",
        transition: "box-shadow 0.15s ease",
        animation: "nextflow-stream-glow 1s ease-in-out infinite",
      };
    case "success":
      return {
        boxShadow: "0 0 0 2px #22c55e, 0 0 0 4px rgba(34,197,94,0.15)",
        transition: "all 0.3s ease",
      };
    case "failed":
      return {
        boxShadow: "0 0 0 2px #ef4444, 0 0 0 4px rgba(239,68,68,0.15)",
        transition: "all 0.3s ease",
      };
    case "queued":
      return {
        boxShadow: "0 0 0 2px #a5b4fc, 0 0 0 4px rgba(165,180,252,0.15)",
        opacity: 0.8,
        transition: "all 0.2s ease",
      };
    case "skipped":
      return { opacity: 0.35, transition: "opacity 0.3s ease" };
    default:
      return {};
  }
}

export function NodeStatusBadge({ status }: { status: RuntimeNodeStatus }) {
  if (status === "idle") return null;

  const config: Record<
    Exclude<RuntimeNodeStatus, "idle">,
    { label: string; className: string }
  > = {
    queued: { label: "Queued", className: "bg-indigo-100 text-indigo-600" },
    running: {
      label: "Running",
      className: "bg-indigo-500 text-white animate-pulse",
    },
    streaming: {
      label: "Streaming",
      className: "bg-violet-500 text-white animate-pulse",
    },
    success: { label: "Done", className: "bg-green-100 text-green-700" },
    failed: { label: "Failed", className: "bg-red-100 text-red-600" },
    skipped: { label: "Skipped", className: "bg-gray-100 text-gray-400" },
  };

  const c = config[status as Exclude<RuntimeNodeStatus, "idle">];
  if (!c) return null;

  return (
    <span
      className={`absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap z-10 ${c.className}`}
    >
      {c.label}
    </span>
  );
}
