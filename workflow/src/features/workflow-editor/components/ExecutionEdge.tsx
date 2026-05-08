"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useState } from "react";
import { useExecutionStore } from "../store/executionStore";

export function ExecutionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [hovered, setHovered] = useState(false);

  const sourceStatus = useExecutionStore(
    (s) => s.nodeStatuses.get(source) ?? "idle",
  );

  const isActive = sourceStatus === "running" || sourceStatus === "streaming";

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = isActive ? "#8b5cf6" : "#6366f1";
  const strokeWidth = isActive ? 2.5 : 2;

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  }

  return (
    <>
      {/* Invisible wide hit area for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: "pointer" }}
      />

      {/* Glow layer for active edges */}
      {isActive && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: "#8b5cf6",
            strokeWidth: 8,
            opacity: 0.15,
            strokeLinecap: "round",
          }}
        />
      )}

      {/* Main edge — solid line */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isActive ? "8 4" : "none",
          animation: isActive
            ? "nextflow-edge-flow 0.8s linear infinite"
            : undefined,
          transition: "stroke 0.3s ease, stroke-width 0.2s ease",
        }}
      />

      {/* Delete button — only on hover */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            onClick={handleDelete}
            className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md transition-all"
            style={{
              opacity: hovered ? 1 : 0,
              transform: hovered ? "scale(1)" : "scale(0.7)",
              transition: "opacity 0.15s ease, transform 0.15s ease",
            }}
            title="Remove connection"
          >
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </EdgeLabelRenderer>

      <style>{`
        @keyframes nextflow-edge-flow {
          from { stroke-dashoffset: 24; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </>
  );
}
