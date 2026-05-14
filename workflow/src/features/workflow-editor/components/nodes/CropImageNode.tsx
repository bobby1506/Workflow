"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useEdges,
  useReactFlow,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import type {
  CropImageNode as CropImageNodeType,
  UploadedAsset,
} from "../../types";
import { HandleDataType } from "../../types";
import { useWorkflowEditorStore } from "../../store/workflowEditorStore";
import { useExecutionStore } from "../../store/executionStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useWorkflowExecution } from "../../hooks/useWorkflowExecution";

// ─── Crop preview overlay on image ───────────────────────────────────────────

function CropPreview({
  imageUrl,
  x,
  y,
  width,
  height,
}: {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden mt-2"
      style={{ height: 180 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Input" className="w-full h-full object-cover" />
      {/* Crop rectangle overlay */}
      <div
        className="absolute border-2 border-indigo-500 bg-indigo-400/10 pointer-events-none"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
      />
    </div>
  );
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

function NodeMenu({
  isLocked,
  onClose,
  onDuplicate,
  onDuplicateWithEdges,
  onLock,
  onDelete,
}: {
  isLocked: boolean;
  onClose: () => void;
  onDuplicate: () => void;
  onDuplicateWithEdges: () => void;
  onLock: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const items = [
    { label: "Duplicate", action: onDuplicate, disabled: isLocked },
    {
      label: "Duplicate with Edges",
      action: onDuplicateWithEdges,
      disabled: isLocked,
    },
    { label: isLocked ? "Unlock" : "Lock", action: onLock },
    { label: "Delete", action: onDelete, danger: true, disabled: isLocked },
  ];

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 w-52 overflow-hidden"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            if (!item.disabled) {
              item.action();
              onClose();
            }
          }}
          disabled={item.disabled}
          className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors ${
            item.disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-50"
          } ${item.danger ? "text-red-500" : "text-gray-800"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Parameter row ────────────────────────────────────────────────────────────

interface ParamRowProps {
  label: string;
  handleId: string;
  value: number;
  defaultValue: number;
  isConnected: boolean;
  isLocked: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
  onConnectToInput: () => void;
}

function ParamRow({
  label,
  handleId,
  value,
  defaultValue,
  isConnected,
  isLocked,
  onChange,
  onReset,
  onConnectToInput,
}: ParamRowProps) {
  return (
    <div className="relative flex items-center gap-2 px-4 py-2.5">
      {/* Pink dot handle */}
      <Handle
        type="target"
        position={Position.Left}
        id={handleId}
        style={{
          background: "#ec4899",
          width: 14,
          height: 14,
          border: "2.5px solid white",
          left: -7,
          top: "50%",
          transform: "translateY(-50%)",
          position: "absolute",
          boxShadow: "0 0 0 2px rgba(236,72,153,0.2)",
        }}
      />

      {/* Label + info */}
      <div className="flex items-center gap-1 w-24 flex-shrink-0">
        <span className="text-xs text-gray-700 font-medium">{label}</span>
        <button
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          title={`${label} — percentage 0-100`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>

      {isConnected ? (
        <div className="flex-1 px-2 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-400 italic">
          Connected
        </div>
      ) : (
        <>
          {/* Slider */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            disabled={isLocked}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="flex-1 h-1.5 accent-indigo-600 disabled:opacity-40 cursor-pointer"
          />

          {/* Number input */}
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            disabled={isLocked}
            onChange={(e) => {
              const v = Math.min(
                100,
                Math.max(0, parseInt(e.target.value) || 0),
              );
              onChange(v);
            }}
            className="w-11 text-xs text-gray-700 text-center border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-indigo-400 bg-white disabled:opacity-40"
          />

          {/* Reset button — always enabled unless locked */}
          <button
            onClick={onReset}
            disabled={isLocked}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-30"
            title="Reset to default"
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
                d="M3 12a9 9 0 109-9M3 12V7m0 5H8"
              />
            </svg>
          </button>

          {/* + connect to input node */}
          <button
            onClick={onConnectToInput}
            disabled={isLocked}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-30"
            title="Connect to input node"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// ─── Crop Image Node ──────────────────────────────────────────────────────────

export function CropImageNode({
  id,
  data,
  selected,
}: NodeProps<CropImageNodeType>) {
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData);
  const nodes = useWorkflowEditorStore((s) => s.nodes);
  const setNodes = useWorkflowEditorStore((s) => s.setNodes);
  const isRunning = useWorkflowEditorStore((s) => s.isRunning);
  const edges = useEdges();
  const { addNodes, addEdges, getEdges } = useReactFlow();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  // Get node execution status for Pending/Running state
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses.get(id) ?? "idle");
  const isPending =
    isRunning && (nodeStatus === "queued" || nodeStatus === "idle");
  const isNodeRunning = nodeStatus === "running";

  const connectedHandles = new Set(
    edges
      .filter((e) => e.target === id)
      .map((e) => e.targetHandle)
      .filter(Boolean),
  );

  const update = useCallback(
    (patch: Record<string, unknown>) => updateNodeData(id, patch),
    [id, updateNodeData],
  );

  const x = data.x ?? 0;
  const y = data.y ?? 0;
  const width = data.width ?? 100;
  const height = data.height ?? 100;

  // ─── Image upload ─────────────────────────────────────────────────────────

  const { triggerUpload, uploadState } = useFileUpload({
    accept: "image/jpeg,image/png,image/webp,image/gif",
    assetType: HandleDataType.IMAGE,
    onUpload: (asset: UploadedAsset) => update({ imageAsset: asset }),
  });

  const imageUrl = data.imageAsset?.url ?? null;
  const isImageConnected = connectedHandles.has("input-image");

  // Get the actual upstream image URL when connected
  const connectedImageUrl = (() => {
    if (!isImageConnected) return null;
    const edge = edges.find(
      (e) => e.target === id && e.targetHandle === "input-image",
    );
    if (!edge) return null;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceNode.type === "request-inputs") {
      const fields = sourceData.fields as
        | Array<{ id: string; asset?: { url: string } | null }>
        | undefined;
      const field = fields?.find((f) => f.id === edge.sourceHandle);
      return field?.asset?.url ?? null;
    }
    return null;
  })();

  const displayImageUrl = isImageConnected ? connectedImageUrl : imageUrl;

  // Wire Run button to single-node execution
  const { runSingle } = useWorkflowExecution();

  // ─── + button on Input Image: add image field to Request-Inputs and connect ─

  function handleConnectImageToInput() {
    const inputNode = nodes.find((n) => n.id === "request-inputs");
    if (!inputNode) return;

    const currentFields =
      (
        inputNode.data as {
          fields: { id: string; label: string; type: string }[];
        }
      ).fields ?? [];
    const prefix = "image_field";
    let label = prefix;
    const imageFields = currentFields.filter((f) => f.type === "image");
    if (imageFields && imageFields.length > 0) {
      const usedLabels = new Set(currentFields.map((f) => f.label));
      let n = 2;
      while (usedLabels.has(`${prefix}_${n}`)) n++;
      label = `${prefix}_${n}`;
    }

    const newFieldId = `${prefix}_${nanoid(6)}`;
    const newField = { id: newFieldId, label, type: "image", asset: null };

    setNodes(
      nodes.map((n) => {
        if (n.id !== "request-inputs") return n;
        return {
          ...n,
          data: { ...n.data, fields: [...currentFields, newField] },
        };
      }) as typeof nodes,
    );

    addEdges([
      {
        id: `e-${newFieldId}-${id}-input-image`,
        source: "request-inputs",
        sourceHandle: newFieldId,
        target: id,
        targetHandle: "input-image",
        type: "default",
      },
    ]);
  }

  // ─── + button on param: add text field to Request-Inputs and connect ──────

  function handleConnectParamToInput(
    paramHandleId: string,
    paramLabel: string,
  ) {
    const inputNode = nodes.find((n) => n.id === "request-inputs");
    if (!inputNode) return;

    const currentFields =
      (
        inputNode.data as {
          fields: { id: string; label: string; type: string }[];
        }
      ).fields ?? [];
    let label = paramLabel.toLowerCase().replace(/\s+/g, "_");
    const usedLabels = new Set(currentFields.map((f) => f.label));
    if (usedLabels.has(label)) {
      let n = 2;
      while (usedLabels.has(`${label}_${n}`)) n++;
      label = `${label}_${n}`;
    }

    const newFieldId = `text_field_${nanoid(6)}`;
    const newField = { id: newFieldId, label, type: "text", value: "" };

    setNodes(
      nodes.map((n) => {
        if (n.id !== "request-inputs") return n;
        return {
          ...n,
          data: { ...n.data, fields: [...currentFields, newField] },
        };
      }) as typeof nodes,
    );

    addEdges([
      {
        id: `e-${newFieldId}-${id}-${paramHandleId}`,
        source: "request-inputs",
        sourceHandle: newFieldId,
        target: id,
        targetHandle: paramHandleId,
        type: "default",
      },
    ]);
  }

  // ─── Duplicate node ───────────────────────────────────────────────────────

  function handleDuplicate(withEdges = false) {
    const newId = nanoid(8);
    const currentNode = nodes.find((n) => n.id === id);
    if (!currentNode) return;

    const newNode = {
      ...currentNode,
      id: newId,
      position: {
        x: currentNode.position.x + 40,
        y: currentNode.position.y + 40,
      },
      selected: false,
      data: { ...currentNode.data },
    };
    addNodes([newNode]);

    if (withEdges) {
      const currentEdges = getEdges();
      const relatedEdges = currentEdges.filter(
        (e) => e.source === id || e.target === id,
      );
      addEdges(
        relatedEdges.map((e) => ({
          ...e,
          id: `${e.id}-copy-${nanoid(4)}`,
          source: e.source === id ? newId : e.source,
          target: e.target === id ? newId : e.target,
        })),
      );
    }
  }

  function handleDelete() {
    setNodes(nodes.filter((n) => n.id !== id) as typeof nodes);
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-visible transition-all duration-150"
      style={{
        minWidth: 340,
        border: isLocked
          ? "2px solid #f59e0b"
          : selected
            ? "2px solid #6366f1"
            : "1.5px solid #e5e7eb",
        boxShadow: isLocked
          ? "0 0 0 3px rgba(245,158,11,0.15)"
          : selected
            ? "0 0 0 3px rgba(99,102,241,0.15)"
            : "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            Crop Image
          </span>

          {/* Info */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowInfoTooltip(true)}
              onMouseLeave={() => setShowInfoTooltip(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
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
                  strokeWidth={1.8}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            {showInfoTooltip && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none">
                Crop an image by percentage coordinates
              </div>
            )}
          </div>

          {/* Reset all */}
          <button
            onClick={() => update({ x: 0, y: 0, width: 100, height: 100 })}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Reset all parameters"
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
                strokeWidth={1.8}
                d="M3 12a9 9 0 109-9M3 12V7m0 5H8"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Run button — Pending when workflow running, Running when this node executes */}
          <button
            onClick={() => !isRunning && !isLocked && runSingle(id)}
            disabled={isLocked || isRunning}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
              isNodeRunning
                ? "bg-indigo-50 border-indigo-200 text-indigo-600 animate-pulse cursor-not-allowed"
                : isPending
                  ? "bg-amber-50 border-amber-200 text-amber-600 cursor-not-allowed"
                  : isLocked
                    ? "bg-amber-50 border-amber-200 text-amber-500 opacity-70 cursor-not-allowed"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            }`}
            title={
              isNodeRunning
                ? "Running…"
                : isPending
                  ? "Pending…"
                  : isLocked
                    ? "Node is locked"
                    : "Run this node"
            }
          >
            {isNodeRunning ? (
              <>
                <svg
                  className="w-3 h-3 animate-spin fill-indigo-500"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" />
                </svg>
                Running
              </>
            ) : isPending ? (
              <>
                <svg className="w-3 h-3 fill-amber-400" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                </svg>
                Pending
              </>
            ) : (
              <>
                <svg
                  className={`w-3 h-3 ${isLocked ? "fill-amber-400" : "fill-green-600"}`}
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run
              </>
            )}
          </button>

          {/* Three dots */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="4.5" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="15.5" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <NodeMenu
                isLocked={isLocked}
                onClose={() => setMenuOpen(false)}
                onDuplicate={() => handleDuplicate(false)}
                onDuplicateWithEdges={() => handleDuplicate(true)}
                onLock={() => setIsLocked((v) => !v)}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {/* Input Image */}
      <div className="relative px-4 py-3 border-b border-gray-100">
        {/* Blue dot handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="input-image"
          style={{
            background: "#3b82f6",
            width: 14,
            height: 14,
            border: "2.5px solid white",
            left: -7,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: "0 0 0 2px rgba(59,130,246,0.2)",
          }}
        />

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">
            Input Image<span className="text-red-400 ml-0.5">*</span>
          </span>

          {/* Upload / Change image button */}
          {!isImageConnected && (
            <button
              onClick={triggerUpload}
              disabled={isLocked || uploadState === "uploading"}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors disabled:opacity-40"
            >
              {uploadState === "uploading" ? (
                <>
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
                  Uploading…
                </>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  {imageUrl ? "Change image" : "Upload image"}
                </>
              )}
            </button>
          )}

          {isImageConnected && (
            <div className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-400 italic text-center">
              Connected
            </div>
          )}

          {/* + connect to input node */}
          {!isImageConnected && (
            <button
              onClick={handleConnectImageToInput}
              disabled={isLocked}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-30"
              title="Add image field to Request-Inputs and connect"
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
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Image preview — show actual image whether local or connected */}
        {displayImageUrl && (
          <div className="mt-2 relative">
            <CropPreview
              imageUrl={displayImageUrl}
              x={x}
              y={y}
              width={width}
              height={height}
            />
            {/* Remove button — only for local uploads */}
            {!isImageConnected && (
              <button
                onClick={() => update({ imageAsset: null })}
                className="absolute top-3 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-gray-900/70 text-white hover:bg-gray-900 transition-colors z-10"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Parameters */}
      <div className="border-b border-gray-100 divide-y divide-gray-50">
        <ParamRow
          label="X Position (%)"
          handleId="param-x"
          value={x}
          defaultValue={0}
          isConnected={connectedHandles.has("param-x")}
          isLocked={isLocked}
          onChange={(v) => update({ x: v })}
          onReset={() => update({ x: 0 })}
          onConnectToInput={() =>
            handleConnectParamToInput("param-x", "x_position")
          }
        />
        <ParamRow
          label="Y Position (%)"
          handleId="param-y"
          value={y}
          defaultValue={0}
          isConnected={connectedHandles.has("param-y")}
          isLocked={isLocked}
          onChange={(v) => update({ y: v })}
          onReset={() => update({ y: 0 })}
          onConnectToInput={() =>
            handleConnectParamToInput("param-y", "y_position")
          }
        />
        <ParamRow
          label="Width (%)"
          handleId="param-width"
          value={width}
          defaultValue={100}
          isConnected={connectedHandles.has("param-width")}
          isLocked={isLocked}
          onChange={(v) => update({ width: v })}
          onReset={() => update({ width: 100 })}
          onConnectToInput={() =>
            handleConnectParamToInput("param-width", "width")
          }
        />
        <ParamRow
          label="Height (%)"
          handleId="param-height"
          value={height}
          defaultValue={100}
          isConnected={connectedHandles.has("param-height")}
          isLocked={isLocked}
          onChange={(v) => update({ height: v })}
          onReset={() => update({ height: 100 })}
          onConnectToInput={() =>
            handleConnectParamToInput("param-height", "height")
          }
        />
      </div>

      {/* Output Image */}
      <div className="relative px-4 py-3">
        <p className="text-sm text-gray-500 font-medium mb-2">Output Image</p>
        <div className="rounded-xl bg-gray-50 border border-gray-100 min-h-[80px] flex items-center justify-center overflow-hidden relative">
          {data.outputImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.outputImageUrl}
                alt="Cropped output"
                className="w-full rounded-xl object-contain max-h-40"
              />
              {/* Download button */}
              <a
                href={data.outputImageUrl}
                download="cropped-image.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-colors"
                title="Download cropped image"
                onClick={(e) => e.stopPropagation()}
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic py-4">No output yet</p>
          )}
        </div>

        {/* Output handle — blue dot on right */}
        <Handle
          type="source"
          position={Position.Right}
          id="output-image"
          style={{
            background: "#3b82f6",
            width: 14,
            height: 14,
            border: "2.5px solid white",
            right: -7,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: "0 0 0 2px rgba(59,130,246,0.2)",
          }}
        />

        {/* Cost indicator */}
        <p className="text-right text-[10px] text-gray-400 mt-2">⚙ ~0.005M</p>
      </div>
    </div>
  );
}
