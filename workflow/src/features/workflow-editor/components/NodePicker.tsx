"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { NODE_PICKER_ITEMS, NODE_PICKER_CATEGORIES } from "../constants";
import type { NodePickerCategory, NodePickerItem } from "../types";

interface NodePickerProps {
  onSelect: (item: NodePickerItem) => void;
  onClose: () => void;
}

export function NodePicker({ onSelect, onClose }: NodePickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<NodePickerCategory>("Recent");
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus search on open
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const filteredItems = useCallback(() => {
    const q = search.toLowerCase().trim();
    if (q) {
      return NODE_PICKER_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      );
    }
    if (activeCategory === "Recent") {
      // Show functional nodes as "recent"
      return NODE_PICKER_ITEMS.filter((item) => item.functional);
    }
    return NODE_PICKER_ITEMS.filter((item) => item.category === activeCategory);
  }, [search, activeCategory]);

  const items = filteredItems();

  return (
    <div
      ref={containerRef}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 w-[480px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
      style={{ pointerEvents: "all" }}
    >
      {/* Search header */}
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
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes or models..."
          className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 bg-transparent outline-none"
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

      <div className="flex" style={{ height: 320 }}>
        {/* Category sidebar */}
        {!search && (
          <div className="w-28 border-r border-gray-100 py-2 flex-shrink-0 overflow-y-auto">
            {NODE_PICKER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "text-gray-900 bg-gray-100"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Node list */}
        <div className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">No nodes found</p>
            </div>
          ) : (
            <>
              {/* Group by category when searching */}
              {search ? (
                <div className="px-2">
                  {items.map((item) => (
                    <NodePickerRow
                      key={`${item.type}-${item.label}`}
                      item={item}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-2">
                  {activeCategory === "Recent" && (
                    <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Recent
                    </p>
                  )}
                  {items.map((item) => (
                    <NodePickerRow
                      key={`${item.type}-${item.label}`}
                      item={item}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NodePickerRow({
  item,
  onSelect,
}: {
  item: NodePickerItem;
  onSelect: (item: NodePickerItem) => void;
}) {
  return (
    <button
      onClick={() => item.functional && onSelect(item)}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors group ${
        item.functional
          ? "hover:bg-gray-50 cursor-pointer"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-base group-hover:bg-gray-200 transition-colors">
        {item.icon}
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">
            {item.label}
          </span>
          {!item.functional && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium flex-shrink-0">
              Soon
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{item.description}</p>
      </div>

      {/* Arrow for functional items */}
      {item.functional && (
        <svg
          className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0"
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
  );
}
