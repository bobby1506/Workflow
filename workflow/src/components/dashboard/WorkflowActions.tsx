"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface WorkflowActionsProps {
  workflowId: string;
  workflowName: string;
  onOpen?: () => void;
}

export function WorkflowActions({
  workflowId,
  workflowName,
  onOpen,
}: WorkflowActionsProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(workflowName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleRename() {
    if (!newName.trim() || newName.trim() === workflowName) {
      setRenaming(false);
      return;
    }
    await fetch(`/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setRenaming(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
    setDeleting(false);
    setShowDeleteConfirm(false);
    router.refresh();
  }

  async function handleExport() {
    setExporting(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${workflowName.replace(/\s+/g, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Rename modal */}
      {renaming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRenaming(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Rename Workflow
            </h3>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenaming(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete Workflow
            </h3>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Are you sure you want to delete &quot;{workflowName}&quot;? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Three-dot button + dropdown */}
      <div ref={menuRef} className="relative">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white transition-colors"
          aria-label="Workflow options"
        >
          <svg
            className="w-4 h-4 text-gray-700"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <circle cx="10" cy="4.5" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="15.5" r="1.5" />
          </svg>
        </button>

        {open && (
          <div
            className="fixed z-[200] w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 overflow-hidden"
            style={{
              top: menuRef.current
                ? menuRef.current.getBoundingClientRect().bottom + 6
                : 0,
              right: menuRef.current
                ? window.innerWidth -
                  menuRef.current.getBoundingClientRect().right
                : 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Open */}
            <button
              onClick={() => {
                setOpen(false);
                onOpen ? onOpen() : router.push(`/workflow/${workflowId}`);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-800 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Open
            </button>

            {/* Rename */}
            <button
              onClick={() => {
                setOpen(false);
                setNewName(workflowName);
                setRenaming(true);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-800 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Rename
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-800 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {exporting ? "Exporting…" : "Export"}
            </button>

            <div className="my-1 mx-3 border-t border-gray-100" />

            {/* Delete */}
            <button
              onClick={() => {
                setOpen(false);
                setShowDeleteConfirm(true);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </>
  );
}

