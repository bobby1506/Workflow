"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreatingOverlay } from "./CreatingOverlay";

interface CreateWorkflowButtonProps {
  label?: string;
  iconOnly?: boolean;
}

export function CreateWorkflowButton({
  label = "New Workflow",
  iconOnly = false,
}: CreateWorkflowButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });
      if (!res.ok) throw new Error("Failed");
      const workflow = await res.json();
      router.push(`/workflow/${workflow.id}`);
    } catch {
      setLoading(false);
    }
  }

  if (iconOnly) {
    return (
      <>
        {/* Fun full-screen creating loader — only for the + button */}
        <CreatingOverlay visible={loading} />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60"
          title="New Workflow"
          aria-label="Create new workflow"
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
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </>
    );
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-700 transition-colors disabled:opacity-60"
    >
      {loading ? (
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
      ) : (
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      )}
      {loading ? "Creating..." : label}
    </button>
  );
}
