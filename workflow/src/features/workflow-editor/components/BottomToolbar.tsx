"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { NodeType } from "../types";
import { NODE_PICKER_ITEMS, NODE_PICKER_CATEGORIES } from "../constants";
import type { WorkflowNode, NodePickerCategory } from "../types";

// ─── Node picker — Galaxy.ai style ───────────────────────────────────────────

interface NodePickerProps {
  onSelect: (type: NodeType) => void;
  onClose: () => void;
}

function NodePicker({ onSelect, onClose }: NodePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  // Load recent types from localStorage
  const [recentTypes, setRecentTypes] = useState<NodeType[]>(() => {
    try {
      const stored = localStorage.getItem("nextflow_recent_nodes");
      return stored
        ? JSON.parse(stored)
        : [NodeType.GEMINI, NodeType.CROP_IMAGE];
    } catch {
      return [NodeType.GEMINI, NodeType.CROP_IMAGE];
    }
  });

  function handleSelect(type: NodeType) {
    // Update recents — add to front, deduplicate, keep max 5
    const updated = [type, ...recentTypes.filter((t) => t !== type)].slice(
      0,
      5,
    );
    setRecentTypes(updated);
    try {
      localStorage.setItem("nextflow_recent_nodes", JSON.stringify(updated));
    } catch {}
    onSelect(type);
    onClose();
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filtered = search.trim()
    ? NODE_PICKER_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  const categorized = NODE_PICKER_CATEGORIES.filter((c) => c !== "Recent")
    .map((cat) => ({
      cat,
      items: NODE_PICKER_ITEMS.filter((item) => item.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  const recentItems = NODE_PICKER_ITEMS.filter(
    (item) => recentTypes.includes(item.type) && item.functional,
  );

  // Category icons
  const catIcons: Record<string, React.ReactNode> = {
    IMAGE: (
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
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    VIDEO: (
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
          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
    AUDIO: (
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
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    LLM: (
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
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
  };

  // Node type icons
  function NodeIcon({ type, label }: { type: NodeType; label: string }) {
    if (type === NodeType.GEMINI) {
      return (
        <svg
          className="w-4 h-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      );
    }
    if (type === NodeType.CROP_IMAGE) {
      return (
        <svg
          className="w-4 h-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-4 h-4 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
        />
      </svg>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ width: 320, maxHeight: 480, pointerEvents: "all" }}
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <svg
          className="w-4 h-4 text-gray-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes or models."
          className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
        />
        <button
          onClick={onClose}
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
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        {filtered ? (
          // Search results
          filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No results found
            </div>
          ) : (
            <div className="py-2">
              {filtered.map((item) => (
                <button
                  key={`${item.type}-${item.label}`}
                  onClick={() => {
                    if (item.functional) handleSelect(item.type);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${item.functional ? "hover:bg-gray-50 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                >
                  <NodeIcon type={item.type} label={item.label} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{item.label}</p>
                  </div>
                  {!item.functional && (
                    <svg
                      className="w-4 h-4 text-gray-300 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Recent */}
            {recentItems.length > 0 && (
              <div className="py-2">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs font-medium text-gray-400">
                    Recent
                  </span>
                </div>
                {recentItems.map((item) => (
                  <button
                    key={`recent-${item.type}-${item.label}`}
                    onClick={() => handleSelect(item.type)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <NodeIcon type={item.type} label={item.label} />
                    <span className="text-sm text-gray-800">{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Categories */}
            {categorized.map(({ cat, items }) => (
              <div key={cat} className="py-2 border-t border-gray-50">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <span className="text-gray-400">
                    {catIcons[cat.toUpperCase()] ?? null}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {cat}
                  </span>
                </div>
                {items.map((item) => (
                  <button
                    key={`${cat}-${item.label}`}
                    onClick={() => {
                      if (item.functional) handleSelect(item.type);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${item.functional ? "hover:bg-gray-50 cursor-pointer" : "opacity-60 cursor-default"}`}
                  >
                    <NodeIcon type={item.type} label={item.label} />
                    <span className="text-sm text-gray-800 flex-1">
                      {item.label}
                    </span>
                    {!item.functional && (
                      <svg
                        className="w-4 h-4 text-gray-300 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bottom Toolbar — just the + button ──────────────────────────────────────

export function BottomToolbar() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addNode = useWorkflowEditorStore((s) => s.addNode);
  const { getViewport } = useReactFlow();

  const handleSelectNode = useCallback(
    (type: NodeType) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offsetX = (Math.random() - 0.5) * 120;
      const offsetY = (Math.random() - 0.5) * 120;
      const position = { x: centerX + offsetX, y: centerY + offsetY };
      const nodeId = nanoid(8);

      let newNode: WorkflowNode;

      if (type === NodeType.GEMINI) {
        newNode = {
          id: nodeId,
          type: NodeType.GEMINI,
          position,
          data: {
            label: "Gemini 3.1 Pro",
            model: "gemini-2.5-flash",
            prompt: "",
            systemPrompt: "",
            settings: {
              temperature: 0.7,
              maxTokens: 2048,
              topP: 0.9,
              topK: 40,
              jsonMode: false,
              reasoning: false,
            },
            settingsOpen: false,
          },
        };
      } else if (type === NodeType.CROP_IMAGE) {
        newNode = {
          id: nodeId,
          type: NodeType.CROP_IMAGE,
          position,
          data: { label: "Crop Image", x: 0, y: 0, width: 100, height: 100 },
        };
      } else {
        return;
      }

      addNode(newNode);
    },
    [addNode, getViewport],
  );

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
      style={{ pointerEvents: "all" }}
    >
      {pickerOpen && (
        <NodePicker
          onSelect={handleSelectNode}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Single + button — no background, just the button itself */}
      <button
        onClick={() => setPickerOpen((v) => !v)}
        className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg transition-all duration-200 ${
          pickerOpen
            ? "bg-gray-900 text-white shadow-xl scale-95"
            : "bg-white text-gray-700 border border-gray-200 hover:shadow-xl hover:scale-105"
        }`}
        title="Add node"
      >
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${pickerOpen ? "rotate-45" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
}
