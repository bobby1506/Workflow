import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
} from "@xyflow/react";
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowEditorState,
  NodeExecutionStatus,
} from "../types";

// ─── Store actions interface ──────────────────────────────────────────────────

interface WorkflowEditorActions {
  initWorkflow: (params: {
    workflowId: string;
    workflowName: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport: Viewport;
  }) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: Viewport) => void;
  setWorkflowName: (name: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  setNodeExecutionStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  setIsRunning: (
    running: boolean,
    scope?: WorkflowEditorState["runScope"],
  ) => void;
  setTriggerRunId: (triggerRunId: string | null) => void;
  setPublicToken: (publicToken: string | null) => void;
  markDirty: () => void;
  markSaved: () => void;
  setIsSaving: (isSaving: boolean) => void;
}

type WorkflowEditorStore = WorkflowEditorState & WorkflowEditorActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: WorkflowEditorState = {
  workflowId: "",
  workflowName: "",
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  isDirty: false,
  isSaving: false,
  isRunning: false,
  runScope: null,
  triggerRunId: null,
  publicToken: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowEditorStore = create<WorkflowEditorStore>()(
  immer((set) => ({
    ...initialState,

    initWorkflow: ({ workflowId, workflowName, nodes, edges, viewport }) => {
      set((state) => {
        state.workflowId = workflowId;
        state.workflowName = workflowName;
        state.nodes = nodes;
        state.edges = edges;
        state.viewport = viewport;
        state.isDirty = false;
        state.isSaving = false;
        state.isRunning = false;
        state.runScope = null;
      });
    },

    setNodes: (nodes) => {
      set((state) => {
        state.nodes = nodes;
        state.isDirty = true;
      });
    },

    setEdges: (edges) => {
      set((state) => {
        state.edges = edges;
        state.isDirty = true;
      });
    },

    addNode: (node) => {
      set((state) => {
        state.nodes.push(node as WorkflowNode);
        state.isDirty = true;
      });
    },

    onNodesChange: (changes) => {
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as WorkflowNode[];
        state.isDirty = true;
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges) as WorkflowEdge[];
        state.isDirty = true;
      });
    },

    onConnect: (connection) => {
      set((state) => {
        state.edges = addEdge(connection, state.edges) as WorkflowEdge[];
        state.isDirty = true;
      });
    },

    setViewport: (viewport) => {
      set((state) => {
        state.viewport = viewport;
        state.isDirty = true;
      });
    },

    setWorkflowName: (name) => {
      set((state) => {
        state.workflowName = name;
        state.isDirty = true;
      });
    },

    updateNodeData: (nodeId, data) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node.data, data);
          state.isDirty = true;
        }
      });
    },

    setNodeExecutionStatus: (nodeId, status) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          (node.data as Record<string, unknown>).executionStatus = status;
        }
      });
    },

    setIsRunning: (running, scope = null) => {
      set((state) => {
        state.isRunning = running;
        state.runScope = scope;
      });
    },

    setTriggerRunId: (triggerRunId) => {
      set((state) => {
        state.triggerRunId = triggerRunId;
      });
    },

    setPublicToken: (publicToken) => {
      set((state) => {
        state.publicToken = publicToken;
      });
    },

    markDirty: () => {
      set((state) => {
        state.isDirty = true;
      });
    },

    markSaved: () => {
      set((state) => {
        state.isDirty = false;
        state.isSaving = false;
      });
    },

    setIsSaving: (isSaving) => {
      set((state) => {
        state.isSaving = isSaving;
      });
    },
  })),
);
