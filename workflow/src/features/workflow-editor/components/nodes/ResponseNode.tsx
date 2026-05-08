"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ResponseNode as ResponseNodeType } from "../../types";

export function ResponseNode({ data, selected }: NodeProps<ResponseNodeType>) {
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const result = data.result as string | null | undefined;
  const isImage = typeof result === "string" && result.startsWith("data:image");

  return (
    <div
      className="bg-white rounded-2xl overflow-visible transition-all duration-150"
      style={{
        minWidth: 260,
        maxWidth: 320,
        border: selected ? "2px solid #6366f1" : "1.5px solid #e5e7eb",
        boxShadow: selected
          ? "0 0 0 3px rgba(99,102,241,0.15)"
          : "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-gray-900 flex-1">
          Response
        </span>
        <div className="relative">
          <button
            onMouseEnter={() => setShowInfoTooltip(true)}
            onMouseLeave={() => setShowInfoTooltip(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          {showInfoTooltip && (
            <div className="absolute right-0 top-full mt-1 z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none">
              Workflow output node
            </div>
          )}
        </div>
      </div>

      {/* Input handle row */}
      <div className="relative px-4 py-2.5 border-b border-gray-100">
        <Handle
          type="target"
          position={Position.Left}
          id="result"
          style={{
            background: "#6366f1",
            width: 14,
            height: 14,
            border: "2.5px solid white",
            left: -7,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: "0 0 0 2px rgba(99,102,241,0.2)",
          }}
        />
        <span className="text-xs text-gray-500 font-medium">result</span>
      </div>

      {/* Output content */}
      <div className="px-4 py-3">
        {!result ? (
          <p className="text-sm text-gray-400 italic text-center py-3">
            No output yet
          </p>
        ) : isImage ? (
          /* Image output with download button */
          <div className="relative rounded-xl overflow-hidden border border-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result}
              alt="Output"
              className="w-full object-contain max-h-48"
            />
            <a
              href={result}
              download="output.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:text-indigo-600 shadow-sm transition-colors"
              title="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </a>
          </div>
        ) : (
          /* Text output — scrollable textarea so user can copy */
          <textarea
            readOnly
            value={result}
            rows={6}
            className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl resize-none outline-none cursor-text"
            style={{ maxHeight: 200 }}
          />
        )}
      </div>
    </div>
  );
}
