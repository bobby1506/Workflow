"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { AUTOSAVE_DELAY } from "../constants";

/**
 * Hardened debounced auto-save hook.
 *
 * Improvements over naive version:
 * - Skips save if workflowId is empty (not yet initialized)
 * - Skips save if a save is already in-flight (prevents race conditions)
 * - Uses a version counter to detect stale saves
 * - Clears timer on unmount to prevent memory leaks
 */
export function useAutoSave() {
  const nodes = useWorkflowEditorStore((s) => s.nodes);
  const edges = useWorkflowEditorStore((s) => s.edges);
  const viewport = useWorkflowEditorStore((s) => s.viewport);
  const isDirty = useWorkflowEditorStore((s) => s.isDirty);
  const workflowId = useWorkflowEditorStore((s) => s.workflowId);
  const setIsSaving = useWorkflowEditorStore((s) => s.setIsSaving);
  const markSaved = useWorkflowEditorStore((s) => s.markSaved);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const versionRef = useRef(0);

  const save = useCallback(
    async (version: number) => {
      if (inFlightRef.current) return;
      if (!workflowId) return;

      inFlightRef.current = true;
      setIsSaving(true);

      try {
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges, viewport }),
        });

        // Only mark saved if this is still the latest version
        if (res.ok && version === versionRef.current) {
          markSaved();
        }
      } catch {
        // Non-critical — will retry on next change
      } finally {
        inFlightRef.current = false;
        setIsSaving(false);
      }
    },
    [workflowId, nodes, edges, viewport, setIsSaving, markSaved],
  );

  useEffect(() => {
    if (!isDirty || !workflowId) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    versionRef.current++;
    const currentVersion = versionRef.current;

    timerRef.current = setTimeout(() => {
      save(currentVersion);
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, viewport, isDirty, workflowId, save]);
}
