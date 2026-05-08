"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { useExecutionStore } from "../store/executionStore";
import { useWorkflowExecution } from "../hooks/useWorkflowExecution";
import { ExportImportMenu } from "./ExportImportMenu";

interface TopBarProps {
  onToggleHistory: () => void;
  historyOpen: boolean;
  onToggleSidebar?: () => void;
}

export function TopBar({
  onToggleHistory,
  historyOpen,
  onToggleSidebar,
}: TopBarProps) {
  const workflowName = useWorkflowEditorStore((s) => s.workflowName);
  const setWorkflowName = useWorkflowEditorStore((s) => s.setWorkflowName);
  const isDirty = useWorkflowEditorStore((s) => s.isDirty);
  const isSaving = useWorkflowEditorStore((s) => s.isSaving);
  const isRunning = useWorkflowEditorStore((s) => s.isRunning);
  const workflowId = useWorkflowEditorStore((s) => s.workflowId);

  const activeRun = useExecutionStore((s) => s.activeRun);
  const { runFull } = useWorkflowExecution();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(workflowName);
  const [cancelling, setCancelling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNameClick = () => {
    setNameValue(workflowName);
    setIsEditingName(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== workflowName) {
      setWorkflowName(trimmed);
    } else {
      setNameValue(workflowName);
    }
  };

  const handleCancel = async () => {
    if (!activeRun?.runId || !workflowId) return;
    setCancelling(true);
    try {
      await fetch(
        `/api/workflows/${workflowId}/run/${activeRun.runId}/cancel`,
        {
          method: "POST",
        },
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 h-12 flex items-center px-4 gap-3 z-10 flex-shrink-0">
      {/* Sidebar toggle */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
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
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Back arrow — rounded square button */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center w-8 h-8 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors flex-shrink-0"
        title="Back to dashboard"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </Link>

      {/* Workflow name — inline editable */}
      {isEditingName ? (
        <input
          ref={inputRef}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setNameValue(workflowName);
              setIsEditingName(false);
            }
          }}
          className="text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-gray-300 min-w-[100px] max-w-[240px]"
          autoFocus
        />
      ) : (
        <button
          onClick={handleNameClick}
          className="text-sm font-semibold text-gray-900 hover:text-gray-600 truncate max-w-[240px] transition-colors text-left"
          title="Click to rename"
        >
          {workflowName}
        </button>
      )}

      {/* Save status */}
      <div className="flex items-center gap-1">
        {isSaving ? (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <svg
              className="w-3 h-3 animate-spin"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Saving…
          </span>
        ) : isDirty ? (
          <span className="text-xs text-amber-500">Unsaved</span>
        ) : (
          <span className="text-xs text-gray-400">Saved</span>
        )}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        <ExportImportMenu />

        {/* History toggle */}
        <button
          onClick={onToggleHistory}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            historyOpen
              ? "text-gray-900 bg-gray-100"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          }`}
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          History
        </button>

        {/* Cancel button */}
        {isRunning && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-60"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}

        {/* Run button — matches Galaxy.ai reference */}
        <button
          onClick={runFull}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-xl transition-all ${
            isRunning
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          }`}
        >
          {isRunning ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin"
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
              Running…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Run
            </>
          )}
        </button>
      </div>
    </header>
  );
}
