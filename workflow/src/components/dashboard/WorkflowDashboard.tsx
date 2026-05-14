"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WorkflowCard } from "./WorkflowCard";
import { SearchBar } from "./SearchBar";
import { CreateWorkflowButton } from "./CreateWorkflowButton";
import { LeftSidebar } from "./LeftSidebar";

interface WorkflowItem {
  id: string;
  name: string;
  updatedAt: string;
  lastRunAt: string | null;
  isTemplate: boolean;
  isReadonly: boolean;
  templateSourceId: string | null;
  hasRunning?: boolean;
}

interface TemplateItem {
  id: string;
  name: string;
  updatedAt: string;
  isTemplate: boolean;
  isReadonly: boolean;
}

interface WorkflowDashboardProps {
  initialWorkflows: WorkflowItem[];
  templates: TemplateItem[];
}

export function WorkflowDashboard({
  initialWorkflows,
  templates,
}: WorkflowDashboardProps) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(initialWorkflows);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiKeyTooltip, setApiKeyTooltip] = useState(false);
  const [importTooltip, setImportTooltip] = useState(false);
  const apiKeyRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const fetchWorkflows = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const url = search
        ? `/api/workflows?search=${encodeURIComponent(search)}`
        : "/api/workflows";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      fetchWorkflows(query);
    },
    [fetchWorkflows],
  );

  async function handleCloneTemplate(templateId: string) {
    const res = await fetch(`/api/workflows/${templateId}/clone`, {
      method: "POST",
    });
    if (res.ok) {
      const cloned = await res.json();
      router.push(`/workflow/${cloned.id}`);
    }
  }

  useEffect(() => {
    setWorkflows(initialWorkflows);
  }, [initialWorkflows]);

  const isEmpty = workflows.length === 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Left sidebar */}
      <LeftSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Sidebar toggle button — top left */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="fixed top-3 left-3 z-30 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        aria-label="Toggle sidebar"
      >
        <svg
          className="w-4 h-4 text-gray-600"
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

      {/* Main content — slides right when sidebar opens */}
      <div
        className="min-h-screen bg-white transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen ? "256px" : "0px" }}
      >
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-16 pl-16">
          {/* Page heading row — "Flow" + API Keys + Import + + button */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Flow</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Build workflows or run models directly.
              </p>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 mt-1">
              {/* API Keys — tooltip only */}
              <div className="relative">
                <button
                  ref={apiKeyRef}
                  onMouseEnter={() => setApiKeyTooltip(true)}
                  onMouseLeave={() => setApiKeyTooltip(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
                      strokeWidth={1.5}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  API Keys
                </button>
                {apiKeyTooltip && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none">
                    Coming soon
                  </div>
                )}
              </div>

              {/* Import — tooltip only */}
              <div className="relative">
                <button
                  ref={importRef}
                  onMouseEnter={() => setImportTooltip(true)}
                  onMouseLeave={() => setImportTooltip(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
                      strokeWidth={1.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Import
                </button>
                {importTooltip && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none">
                    Coming soon
                  </div>
                )}
              </div>

              {/* Create new workflow */}
              <CreateWorkflowButton iconOnly />
            </div>
          </div>

          {/* ── System Workflows ─────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              System Workflows
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Pre-built workflow templates — click to open and start using.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map((t) => (
                <WorkflowCard
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  updatedAt={new Date(t.updatedAt)}
                  isTemplate={true}
                  onClone={() => handleCloneTemplate(t.id)}
                />
              ))}
            </div>
          </section>

          {/* ── Your Workflows ───────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Your Workflows
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Open one to edit, run, and review history.
                </p>
              </div>

              {/* Search — rightmost, no count */}
              <SearchBar onSearch={handleSearch} />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <svg
                  className="w-5 h-5 animate-spin text-gray-400"
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
            ) : isEmpty && searchQuery ? (
              <div className="border border-gray-200 rounded-xl bg-white px-6 py-8 text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  No results for &quot;{searchQuery}&quot;
                </p>
                <p className="text-sm text-gray-400">
                  Try a different search term.
                </p>
              </div>
            ) : isEmpty ? (
              <div className="border border-gray-200 rounded-xl bg-white px-6 py-8">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  No workflows yet
                </p>
                <p className="text-sm text-gray-400 mb-5">
                  Create your first workflow to start building.
                </p>
                <CreateWorkflowButton label="Create workflow" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {workflows.map((w) => (
                  <WorkflowCard
                    key={w.id}
                    id={w.id}
                    name={w.name}
                    updatedAt={new Date(w.updatedAt)}
                    lastRunAt={w.lastRunAt ? new Date(w.lastRunAt) : null}
                    isRunning={w.hasRunning === true}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
