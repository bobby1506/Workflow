"use client";

import { useEffect, useCallback } from "react";
import { useCopyPaste } from "./useCopyPaste";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { useHistoryStore } from "../store/historyStore";
import { NON_DELETABLE_NODES } from "../constants";

/**
 * Keyboard shortcuts for the workflow editor.
 * Cmd/Ctrl+Z       → Undo
 * Cmd/Ctrl+Shift+Z → Redo
 * Cmd/Ctrl+C       → Copy selected nodes
 * Cmd/Ctrl+V       → Paste nodes
 * Cmd/Ctrl+D       → Duplicate selected
 * Escape           → Deselect all
 */
export function useKeyboardShortcuts() {
  const { copy, paste, duplicate } = useCopyPaste();
  const nodes = useWorkflowEditorStore((s) => s.nodes);
  const edges = useWorkflowEditorStore((s) => s.edges);
  const setNodes = useWorkflowEditorStore((s) => s.setNodes);
  const setEdges = useWorkflowEditorStore((s) => s.setEdges);

  const { undo, redo, pushSnapshot } = useHistoryStore.getState();

  const handleUndo = useCallback(() => {
    const previous = undo();
    if (!previous) return;
    // Push current state to future before restoring
    useHistoryStore.getState().future.unshift({
      nodes: useWorkflowEditorStore.getState().nodes,
      edges: useWorkflowEditorStore.getState().edges,
    });
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const current = {
      nodes: useWorkflowEditorStore.getState().nodes,
      edges: useWorkflowEditorStore.getState().edges,
    };
    const next = redo(current);
    if (!next) return;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Undo: Cmd+Z
      if (isMod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((isMod && e.shiftKey && e.key === "z") || (isMod && e.key === "y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isMod && e.key === "c") {
        e.preventDefault();
        copy();
        return;
      }

      if (isMod && e.key === "v") {
        e.preventDefault();
        // Push snapshot before paste
        pushSnapshot({
          nodes: useWorkflowEditorStore.getState().nodes,
          edges: useWorkflowEditorStore.getState().edges,
        });
        paste();
        return;
      }

      if (isMod && e.key === "d") {
        e.preventDefault();
        const currentNodes = useWorkflowEditorStore.getState().nodes;
        const selected = currentNodes.filter(
          (n) => n.selected && !NON_DELETABLE_NODES.includes(n.id),
        );
        if (selected.length > 0) {
          pushSnapshot({
            nodes: currentNodes,
            edges: useWorkflowEditorStore.getState().edges,
          });
          selected.forEach((n) => duplicate(n.id));
        }
        return;
      }

      if (e.key === "Escape") {
        const currentNodes = useWorkflowEditorStore.getState().nodes;
        setNodes(currentNodes.map((n) => ({ ...n, selected: false })));
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copy, paste, duplicate, setNodes, handleUndo, handleRedo, pushSnapshot]);
}

/**
 * Hook to push a history snapshot before significant mutations.
 * Call this before adding/removing nodes or edges.
 */
export function usePushHistory() {
  return useCallback(() => {
    const { nodes, edges } = useWorkflowEditorStore.getState();
    useHistoryStore.getState().pushSnapshot({ nodes, edges });
  }, []);
}
