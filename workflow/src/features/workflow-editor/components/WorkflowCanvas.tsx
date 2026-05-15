"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Viewport,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import { ExecutionEdge } from "./ExecutionEdge";
import { TopBar } from "./TopBar";
import { BottomToolbar } from "./BottomToolbar";
import { HistorySidebar } from "./HistorySidebar";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { LeftSidebar } from "@/components/dashboard/LeftSidebar";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { useExecutionStore } from "../store/executionStore";
import { useHistoryStore } from "../store/historyStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { useRealtimeExecution } from "../hooks/useRealtimeExecution";
import { useWorkflowRunRealtime } from "../hooks/useWorkflowRunRealtime";
import { useWorkflowStream } from "../hooks/useWorkflowStream";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { DEFAULT_EDGE_OPTIONS, NON_DELETABLE_NODES } from "../constants";
import { isValidConnection } from "../utils/edgeValidation";
import { nodeStatusStyle } from "./NodeStatusOverlay";
import type { WorkflowNode, WorkflowEdge } from "../types";

// ─── Edge types registry ──────────────────────────────────────────────────────

const edgeTypes = {
  default: ExecutionEdge,
  execution: ExecutionEdge,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  initialViewport: Viewport;
  workflowId: string;
  workflowName: string;
}

// ─── Inner canvas ─────────────────────────────────────────────────────────────

function CanvasInner({
  initialNodes,
  initialEdges,
  initialViewport,
  workflowId,
  workflowName,
}: WorkflowCanvasProps) {
  const { fitView } = useReactFlow();

  const nodes = useWorkflowEditorStore((s) => s.nodes);
  const edges = useWorkflowEditorStore((s) => s.edges);
  const onNodesChange = useWorkflowEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowEditorStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowEditorStore((s) => s.onConnect);
  const setViewport = useWorkflowEditorStore((s) => s.setViewport);
  const initWorkflow = useWorkflowEditorStore((s) => s.initWorkflow);

  // Live execution status from store
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);

  // Auto-save
  useAutoSave();

  // SSE realtime execution sync
  useRealtimeExecution();

  // Trigger.dev Realtime hooks — consolidated at top level to avoid loops
  const triggerRunId = useWorkflowEditorStore((s) => s.triggerRunId);
  const publicToken = useWorkflowEditorStore((s) => s.publicToken);

  useWorkflowRunRealtime({ triggerRunId, publicToken });

  // Gemini streaming for first gemini node
  const firstGeminiNode = nodes.find((n) => n.type === "gemini");
  const geminiStreamName = (firstGeminiNode?.data?.streamName as string) ?? null;

  useWorkflowStream({
    triggerRunId,
    nodeId: firstGeminiNode?.id ?? null,
    streamName: geminiStreamName,
    publicToken,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize store on mount
  useEffect(() => {
    initWorkflow({
      workflowId,
      workflowName,
      nodes: initialNodes,
      edges: initialEdges,
      viewport: initialViewport,
    });
  }, [
    workflowId,
    workflowName,
    initialNodes,
    initialEdges,
    initialViewport,
    initWorkflow,
  ]);

  // Fit view after init
  useEffect(() => {
    const timer = setTimeout(
      () => fitView({ padding: 0.2, duration: 300 }),
      100,
    );
    return () => clearTimeout(timer);
  }, [fitView]);

  // Inject execution status styles into nodes
  const styledNodes = useMemo(() => {
    // ✅ Return empty array if nodes is undefined/not an array
    if (!nodes || !Array.isArray(nodes)) {
      return [];
    }

    if (!nodeStatuses) {
      return nodes;
    }

    return nodes.map((node) => {
      const status = nodeStatuses.get(node.id) ?? "idle";
      const statusStyle = nodeStatusStyle(status);
      return {
        ...node,
        style: { ...node.style, ...statusStyle },
      };
    });
  }, [nodes, nodeStatuses]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      // Guard against undefined or non-array changes
      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        return;
      }

      const filtered = changes.filter((c) =>
        c.type === "remove" ? !NON_DELETABLE_NODES.includes(c.id) : true,
      );

      if (filtered.length > 0) {
        // Push history snapshot before remove operations
        const hasRemove = filtered.some((c) => c.type === "remove");
        if (hasRemove) {
          useHistoryStore.getState().pushSnapshot({
            nodes: useWorkflowEditorStore.getState().nodes,
            edges: useWorkflowEditorStore.getState().edges,
          });
        }
        onNodesChange(filtered);
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowEdge>[]) => {
      // Push history snapshot before remove operations
      const hasRemove = changes.some((c) => c.type === "remove");
      if (hasRemove) {
        useHistoryStore.getState().pushSnapshot({
          nodes: useWorkflowEditorStore.getState().nodes,
          edges: useWorkflowEditorStore.getState().edges,
        });
      }
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isValidConnection(connection, nodes, edges)) {
        useHistoryStore.getState().pushSnapshot({ nodes, edges });
        onConnect(connection);
      }
    },
    [nodes, edges, onConnect],
  );

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => setViewport(viewport),
    [setViewport],
  );

  const connectionValidator = useCallback(
    (connection: Connection | WorkflowEdge) => {
      // Guard against undefined nodes or edges
      if (!nodes || !Array.isArray(nodes) || !edges || !Array.isArray(edges)) {
        return false;
      }

      const conn: Connection = {
        source: connection.source ?? "",
        target: connection.target ?? "",
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      };

      return isValidConnection(conn, nodes, edges);
    },
    [nodes, edges],
  );

  return (
    <div className="flex-1 relative overflow-hidden">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onMoveEnd={handleMoveEnd}
        isValidConnection={connectionValidator}
        defaultViewport={initialViewport}
        fitView={false}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
        style={{ background: "#f0f0f0" }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#c8c8c8"
          style={{ background: "#f0f0f0" }}
        />
        <Controls
          position="bottom-left"
          style={{ bottom: 24, left: 16 }}
          showInteractive={false}
        />
        <MiniMap
          position="bottom-right"
          style={{
            bottom: 24,
            right: 16,
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 8,
          }}
          nodeColor="#6366f1"
          maskColor="rgba(0,0,0,0.4)"
        />
        <BottomToolbar />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <CanvasErrorBoundary>
      {/* Left sidebar — same as dashboard */}
      <LeftSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        className="flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen ? "256px" : "0px" }}
      >
        <TopBar
          onToggleHistory={() => setHistoryOpen((v) => !v)}
          historyOpen={historyOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <div className="flex flex-1 overflow-hidden">
          <ReactFlowProvider>
            <CanvasInner {...props} />
          </ReactFlowProvider>
          <HistorySidebar
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      </div>
    </CanvasErrorBoundary>
  );
}
