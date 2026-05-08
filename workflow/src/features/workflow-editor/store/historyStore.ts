import { create } from "zustand";
import type { WorkflowNode, WorkflowEdge } from "../types";

// ─── Undo/Redo history store ──────────────────────────────────────────────────
// Stores snapshots of nodes+edges for Cmd+Z / Cmd+Shift+Z

interface HistorySnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

interface HistoryActions {
  pushSnapshot: (snapshot: HistorySnapshot) => void;
  undo: () => HistorySnapshot | null;
  redo: (current: HistorySnapshot) => HistorySnapshot | null;
  clear: () => void;
}

type HistoryStore = HistoryState & HistoryActions;

const MAX_HISTORY = 50;

export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  past: [],
  future: [],

  pushSnapshot: (snapshot) => {
    set((state) => ({
      past: [...state.past.slice(-MAX_HISTORY + 1), snapshot],
      future: [], // clear redo stack on new action
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
    }));
    return previous;
  },

  redo: (current) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set((state) => ({
      future: state.future.slice(1),
      past: [...state.past, current],
    }));
    return next;
  },

  clear: () => set({ past: [], future: [] }),
}));
