"use client";

import { useState, useRef, useEffect } from "react";
import { useExecutionStore } from "../store/executionStore";
import { useRunHistory } from "../hooks/useRunHistory";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import type { RunRecord, NodeExecutionRecord } from "../store/executionStore";
import type { DbRun, DbNodeRun } from "../hooks/useRunHistory";

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type RunFilter =
  | "All"
  | "Queued"
  | "Running"
  | "Waiting"
  | "Completed"
  | "Failed"
  | "Canceled";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms?: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts: string | number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    ", " +
    d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "running" || s === "running")
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
    );
  if (s === "success" || s === "completed")
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
    );
  if (s === "failed")
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
    );
  if (s === "canceled" || s === "cancelled")
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
    );
  if (s === "queued" || s === "waiting")
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
    );
  return (
    <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
  );
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "success") return "Completed";
  if (s === "running") return "Running";
  if (s === "failed") return "Failed";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  if (s === "queued") return "Queued";
  if (s === "partial") return "Partial";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ─── Filter dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  value,
  onChange,
}: {
  value: RunFilter;
  onChange: (v: RunFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options: RunFilter[] = [
    "All",
    "Queued",
    "Running",
    "Waiting",
    "Completed",
    "Failed",
    "Canceled",
  ];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {value}
        <svg
          className="w-3.5 h-3.5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-40 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors text-left"
            >
              {opt === value && (
                <svg
                  className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {opt !== value && <span className="w-3.5 h-3.5 flex-shrink-0" />}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Node status icon ─────────────────────────────────────────────────────────

function NodeStatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "success")
    return <span className="text-green-500 text-xs">✅</span>;
  if (s === "failed") return <span className="text-red-500 text-xs">❌</span>;
  if (s === "running")
    return (
      <svg
        className="w-3 h-3 animate-spin text-indigo-500 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
    );
  if (s === "queued" || s === "pending")
    return <span className="text-gray-400 text-xs">⏳</span>;
  return <span className="text-gray-300 text-xs">○</span>;
}

// ─── Run row ──────────────────────────────────────────────────────────────────

function DbRunRow({ run, index }: { run: DbRun; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const workflowId = useWorkflowEditorStore((s) => s.workflowId);

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    if (!workflowId) return;
    setRetrying(true);
    try {
      await fetch(`/api/workflows/${workflowId}/run/${run.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: run.scope }),
      });
    } finally {
      setRetrying(false);
    }
  }

  const label = statusLabel(run.status);
  const credits = run.duration
    ? `${((run.duration / 1000) * 0.01).toFixed(2)}M`
    : "0M";

  return (
    <div
      className={`border border-gray-200 rounded-xl mb-2 overflow-hidden transition-all ${
        run.status === "RUNNING" ? "border-blue-200 bg-blue-50/30" : "bg-white"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <StatusDot status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">{label}</span>
            <span className="text-xs text-gray-400">
              {formatTimestamp(run.startedAt)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Credits: {credits}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-1">
          {!run.nodeRuns || run.nodeRuns.length === 0 ? (
            <p className="text-xs text-gray-400">No node details yet</p>
          ) : (
            run.nodeRuns.map((nr) => (
              <div key={nr.id} className="flex items-center gap-2 py-1">
                <NodeStatusIcon status={nr.status} />
                <span className="flex-1 text-xs text-gray-600 truncate font-mono">
                  {nr.nodeId}
                </span>
                <span className="text-[10px] text-gray-400">
                  {formatDuration(nr.duration)}
                </span>
              </div>
            ))
          )}
          {(run.status === "FAILED" || run.status === "PARTIAL") && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="mt-1 px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryRunRow({ run, index }: { run: RunRecord; index: number }) {
  const [expanded, setExpanded] = useState(run.status === "running");
  const credits = run.durationMs
    ? `${((run.durationMs / 1000) * 0.01).toFixed(2)}M`
    : "0M";

  return (
    <div
      className={`border rounded-xl mb-2 overflow-hidden ${
        run.status === "running"
          ? "border-blue-200 bg-blue-50/30"
          : "border-gray-200 bg-white"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <StatusDot status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">
              {statusLabel(run.status)}
            </span>
            <span className="text-xs text-gray-400">
              {formatTimestamp(run.startedAt)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Credits: {credits}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-1">
          {run.nodeRecords.map((record) => (
            <div key={record.nodeId} className="flex items-center gap-2 py-1">
              <NodeStatusIcon status={record.status} />
              <span className="flex-1 text-xs text-gray-600 truncate font-mono">
                {record.nodeId}
              </span>
              <span className="text-[10px] text-gray-400">
                {formatDuration(record.durationMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History Sidebar ──────────────────────────────────────────────────────────

export function HistorySidebar({ isOpen, onClose }: HistorySidebarProps) {
  const workflowId = useWorkflowEditorStore((s) => s.workflowId);
  const activeRun = useExecutionStore((s) => s.activeRun);
  const memoryHistory = useExecutionStore((s) => s.runHistory);
  const { runs: dbRuns, loading, refetch } = useRunHistory(workflowId);
  const [filter, setFilter] = useState<RunFilter>("All");
  const [activeTab, setActiveTab] = useState<"ui" | "api">("ui");

  // Auto-refetch DB runs when a run completes (activeRun transitions to null)
  const prevActiveRun = useRef<string | null>(null);
  useEffect(() => {
    const currentId = activeRun?.runId ?? null;
    if (prevActiveRun.current !== null && currentId === null) {
      // Run just completed — refetch DB runs after a short delay
      setTimeout(() => refetch(), 500);
    }
    prevActiveRun.current = currentId;
  }, [activeRun, refetch]);

  if (!isOpen) return null;

  const hasActiveRun = !!activeRun;

  // Filter runs
  const filteredDbRuns = dbRuns.filter((run) => {
    if (filter === "All") return true;
    const s = run.status.toLowerCase();
    if (filter === "Running") return s === "running";
    if (filter === "Completed") return s === "success" || s === "completed";
    if (filter === "Failed") return s === "failed";
    if (filter === "Canceled") return s === "canceled" || s === "cancelled";
    if (filter === "Queued") return s === "queued";
    if (filter === "Waiting") return s === "waiting" || s === "pending";
    return true;
  });

  const totalCount = (hasActiveRun ? 1 : 0) + filteredDbRuns.length;

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">
          Execution History
        </h2>
        <button
          onClick={onClose}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 flex-shrink-0 px-4 pt-2">
        <button
          onClick={() => setActiveTab("ui")}
          className={`flex-1 pb-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "ui"
              ? "text-gray-900 border-gray-900"
              : "text-gray-400 border-transparent hover:text-gray-600"
          }`}
        >
          UI Runs
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`flex-1 pb-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "api"
              ? "text-gray-900 border-gray-900"
              : "text-gray-400 border-transparent hover:text-gray-600"
          }`}
        >
          API Runs
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700">Run history</span>
        <FilterDropdown value={filter} onChange={setFilter} />
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && totalCount === 0 ? (
          <div className="flex items-center justify-center h-20">
            <svg
              className="w-4 h-4 animate-spin text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">
              No runs for this filter yet.
            </p>
          </div>
        ) : (
          <>
            {activeRun && (
              <MemoryRunRow run={activeRun} index={filteredDbRuns.length} />
            )}
            {filteredDbRuns.map((run, i) => (
              <DbRunRow
                key={run.id}
                run={run}
                index={filteredDbRuns.length - 1 - i}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
