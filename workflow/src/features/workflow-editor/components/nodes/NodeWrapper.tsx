"use client";

import { memo } from "react";
import { useExecutionStore } from "../../store/executionStore";
import { nodeStatusStyle, NodeStatusBadge } from "../NodeStatusOverlay";

interface NodeWrapperProps {
  nodeId: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Memoized node wrapper that applies live execution status styles.
 * Uses a targeted Zustand selector to avoid re-rendering on unrelated state changes.
 */
export const NodeWrapper = memo(function NodeWrapper({
  nodeId,
  children,
  className = "",
  style = {},
}: NodeWrapperProps) {
  // Targeted selector — only re-renders when THIS node's status changes
  const status = useExecutionStore((s) => s.nodeStatuses.get(nodeId) ?? "idle");
  const statusStyle = nodeStatusStyle(status);

  return (
    <div
      className={`relative rounded-xl transition-all duration-300 ${className}`}
      style={{ ...style, ...statusStyle }}
    >
      <NodeStatusBadge status={status} />
      {children}
    </div>
  );
});
