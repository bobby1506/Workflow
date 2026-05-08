"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readWorkflowFile,
  validateWorkflowImport,
} from "@/lib/workflow-io/importer";

export function ImportWorkflowButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const raw = await readWorkflowFile(file);
      const validation = validateWorkflowImport(raw);
      if (!validation.valid) {
        setError(`Invalid file: ${validation.errors[0]}`);
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
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-60"
        aria-label="Import workflow from JSON file"
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        {loading ? "Importing…" : "Import"}
      </button>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
