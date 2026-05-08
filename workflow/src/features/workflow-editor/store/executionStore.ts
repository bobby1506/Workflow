import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

// Enable Immer's MapSet plugin — required because this store uses Map<> inside immer state
enableMapSet();

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuntimeNodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "streaming"
  | "success"
  | "failed"
  | "skipped";

export interface NodeExecutionRecord {
  nodeId: string;
  nodeType: string;
  status: RuntimeNodeStatus;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  /** Partial streaming text (Gemini only) */
  streamingText?: string;
  error?: string;
  nodeRunId?: string;
}

export interface RunRecord {
  runId: string;
  scope: "full" | "selected" | "single";
  status: "running" | "success" | "failed" | "partial";
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  nodeRecords: NodeExecutionRecord[];
}

export interface ExecutionState {
  activeRun: RunRecord | null;
  runHistory: RunRecord[];
  nodeStatuses: Map<string, RuntimeNodeStatus>;
  /** Live streaming text per node */
  streamingTexts: Map<string, string>;
}

interface ExecutionActions {
  startRun: (
    runId: string,
    scope: RunRecord["scope"],
    nodeIds: string[],
  ) => void;
  setNodeStatus: (nodeId: string, status: RuntimeNodeStatus) => void;
  recordNodeStart: (
    nodeId: string,
    nodeType: string,
    input: Record<string, unknown>,
    nodeRunId?: string,
  ) => void;
  recordNodeSuccess: (
    nodeId: string,
    output: Record<string, unknown>,
    durationMs: number,
  ) => void;
  recordNodeFailure: (
    nodeId: string,
    error: string,
    durationMs: number,
  ) => void;
  updateStreamingText: (nodeId: string, text: string) => void;
  finishRun: (status: RunRecord["status"]) => void;
  clearActiveRun: () => void;
  resetNodeStatuses: () => void;
}

type ExecutionStore = ExecutionState & ExecutionActions;

export const useExecutionStore = create<ExecutionStore>()(
  immer((set) => ({
    activeRun: null,
    runHistory: [],
    nodeStatuses: new Map(),
    streamingTexts: new Map(),

    startRun: (runId, scope, nodeIds) => {
      set((state) => {
        state.activeRun = {
          runId,
          scope,
          status: "running",
          startedAt: Date.now(),
          nodeRecords: nodeIds.map((id) => ({
            nodeId: id,
            nodeType: "unknown",
            status: "queued",
          })),
        };
        state.nodeStatuses = new Map(nodeIds.map((id) => [id, "queued"]));
        state.streamingTexts = new Map();
      });
    },

    setNodeStatus: (nodeId, status) => {
      set((state) => {
        state.nodeStatuses.set(nodeId, status);
        if (state.activeRun) {
          const record = state.activeRun.nodeRecords.find(
            (r) => r.nodeId === nodeId,
          );
          if (record) record.status = status;
        }
      });
    },

    recordNodeStart: (nodeId, nodeType, input, nodeRunId) => {
      set((state) => {
        state.nodeStatuses.set(nodeId, "running");
        if (state.activeRun) {
          const record = state.activeRun.nodeRecords.find(
            (r) => r.nodeId === nodeId,
          );
          if (record) {
            record.nodeType = nodeType;
            record.status = "running";
            record.startedAt = Date.now();
            record.input = input;
            if (nodeRunId) record.nodeRunId = nodeRunId;
          }
        }
      });
    },

    recordNodeSuccess: (nodeId, output, durationMs) => {
      set((state) => {
        state.nodeStatuses.set(nodeId, "success");
        state.streamingTexts.delete(nodeId);
        if (state.activeRun) {
          const record = state.activeRun.nodeRecords.find(
            (r) => r.nodeId === nodeId,
          );
          if (record) {
            record.status = "success";
            record.finishedAt = Date.now();
            record.durationMs = durationMs;
            record.output = output;
            record.streamingText = undefined;
          }
        }
      });
    },

    recordNodeFailure: (nodeId, error, durationMs) => {
      set((state) => {
        state.nodeStatuses.set(nodeId, "failed");
        state.streamingTexts.delete(nodeId);
        if (state.activeRun) {
          const record = state.activeRun.nodeRecords.find(
            (r) => r.nodeId === nodeId,
          );
          if (record) {
            record.status = "failed";
            record.finishedAt = Date.now();
            record.durationMs = durationMs;
            record.error = error;
          }
        }
      });
    },

    updateStreamingText: (nodeId, text) => {
      set((state) => {
        state.nodeStatuses.set(nodeId, "streaming");
        state.streamingTexts.set(nodeId, text);
        if (state.activeRun) {
          const record = state.activeRun.nodeRecords.find(
            (r) => r.nodeId === nodeId,
          );
          if (record) {
            record.status = "streaming";
            record.streamingText = text;
          }
        }
      });
    },

    finishRun: (status) => {
      set((state) => {
        if (!state.activeRun) return;
        const finishedAt = Date.now();
        state.activeRun.status = status;
        state.activeRun.finishedAt = finishedAt;
        state.activeRun.durationMs = finishedAt - state.activeRun.startedAt;
        state.runHistory.unshift({ ...state.activeRun });
        state.activeRun = null;
        state.streamingTexts = new Map();
      });
    },

    clearActiveRun: () => {
      set((state) => {
        state.activeRun = null;
        state.streamingTexts = new Map();
      });
    },

    resetNodeStatuses: () => {
      set((state) => {
        state.nodeStatuses = new Map();
        state.streamingTexts = new Map();
      });
    },
  })),
);
