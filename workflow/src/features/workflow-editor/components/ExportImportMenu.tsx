"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { downloadWorkflowJSON } from "@/lib/workflow-io/exporter";
import {
  readWorkflowFile,
  validateWorkflowImport,
} from "@/lib/workflow-io/importer";

export function ExportImportMenu() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const workflowId = useWorkflowEditorStore((s) => s.workflowId);
  const workflowName = useWorkflowEditorStore((s) => s.workflowName);

  async function handleExport() {
    setOpen(false);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/export`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      downloadWorkflowJSON(data, workflowName);
    } catch {
      setError("Export failed. Please try again.");
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setError(null);
    try {
      const raw = await readWorkflowFile(file);
      const validation = validateWorkflowImport(raw);
      if (!validation.valid) {
        setError(`Invalid file: ${validation.errors.join(", ")}`);
        return;
      }

      const res = await fetch("/api/workflows/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Import failed");
      }

      const { id } = await res.json();
      router.push(`/workflow/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        title="Export / Import"
        aria-label="Export or import workflow"
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export JSON
          </button>
          <button
            onClick={() => {
              setOpen(false);
              fileInputRef.current?.click();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {importing ? "Importing…" : "Import JSON"}
          </button>
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-12 z-50 w-56 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-[10px] text-red-400 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.nextflow.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
