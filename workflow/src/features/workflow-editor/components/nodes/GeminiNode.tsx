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
import type { GeminiNode as GeminiNodeType, UploadedAsset } from "../../types";
import { HandleDataType } from "../../types";
import { useWorkflowEditorStore } from "../../store/workflowEditorStore";
import { useExecutionStore } from "../../store/executionStore";
import { useFileUpload } from "../../hooks/useFileUpload";
import { useWorkflowExecution } from "../../hooks/useWorkflowExecution";

function ExpandModal({
  label,
  value,
  onChange,
  onClose,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[560px] max-w-[90vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{label}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-64 px-3 py-2 text-sm text-gray-800 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-indigo-400"
        />
      </div>
    </div>
  );
}

function TextInputRow({
  label,
  handleId,
  handleColor,
  isConnected,
  connectedValue,
  value,
  onChange,
  placeholder,
  required,
  isLocked,
  showPlus,
  onConnectToInput,
}: {
  label: string;
  handleId: string;
  handleColor: string;
  isConnected: boolean;
  connectedValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  isLocked?: boolean;
  showPlus?: boolean;
  onConnectToInput?: () => void;
}) {
  const [expandOpen, setExpandOpen] = useState(false);
  return (
    <>
      {expandOpen && (
        <ExpandModal
          label={label}
          value={value ?? ""}
          onChange={(v) => onChange?.(v)}
          onClose={() => setExpandOpen(false)}
        />
      )}
      <div className="relative px-4 py-2.5 border-b border-gray-50">
        <Handle
          type="target"
          position={Position.Left}
          id={handleId}
          style={{
            background: handleColor,
            width: 12,
            height: 12,
            border: "2.5px solid white",
            left: -6,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: `0 0 0 2px ${handleColor}33`,
          }}
        />
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-700">
              {label}
              {required && <span className="text-red-400 ml-0.5">*</span>}
            </span>
            <button
              className="text-gray-300 hover:text-gray-500 transition-colors"
              title={`About ${label}`}
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
                  strokeWidth={1.8}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
          {showPlus && onConnectToInput && (
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
          )}
        </div>
        {isConnected ? (
          // Show connected value as plain disabled textarea — no blue shade, no badge
          <div className="relative">
            <textarea
              value={connectedValue ?? ""}
              readOnly
              rows={3}
              placeholder="Value will come from connected node…"
              className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500 placeholder:text-gray-300 resize-none outline-none cursor-not-allowed opacity-70"
            />
          </div>
        ) : (
          <div className="relative">
            <textarea
              value={value ?? ""}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={placeholder}
              rows={3}
              disabled={isLocked}
              className="nodrag w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder:text-gray-300 resize-none outline-none focus:border-gray-300 focus:bg-white transition-colors disabled:opacity-40"
            />
            <button
              onClick={() => setExpandOpen(true)}
              className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg bg-gray-200/80 hover:bg-gray-300 transition-colors"
              title="Expand"
            >
              <svg
                className="w-3.5 h-3.5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function MultiImageUpload({
  images,
  isConnected,
  isLocked,
  onAdd,
  onRemove,
}: {
  images: UploadedAsset[];
  isConnected: boolean;
  isLocked?: boolean;
  onAdd: (asset: UploadedAsset) => void;
  onRemove: (index: number) => void;
}) {
  const { triggerUpload, uploadState } = useFileUpload({
    accept: "image/jpeg,image/png,image/webp,image/gif",
    assetType: HandleDataType.IMAGE,
    onUpload: onAdd,
  });
  if (isConnected)
    return (
      <div className="px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-400 italic">
        Connected
      </div>
    );
  return (
    <div>
      <button
        onClick={triggerUpload}
        disabled={isLocked || uploadState === "uploading"}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors disabled:opacity-40 mb-1.5"
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
            Upload image
          </>
        )}
      </button>
      {!images ||
        (images.length === 0 && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-1.5">
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
            Upload requirements
          </p>
        ))}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.filename}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/60 text-white text-[9px] font-bold rounded flex items-center justify-center">
                {i + 1}
              </span>
              <button
                onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded flex items-center justify-center hover:bg-red-500 transition-colors"
              >
                <svg
                  className="w-2.5 h-2.5"
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
            </div>
          ))}
          <button
            onClick={triggerUpload}
            disabled={isLocked}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors text-[10px] gap-0.5"
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
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function MediaRow({
  label,
  handleId,
  handleColor,
  isConnected,
  isLocked,
  uploadLabel,
  accept,
  assetType,
  onUpload,
  onConnectToInput,
}: {
  label: string;
  handleId: string;
  handleColor: string;
  isConnected: boolean;
  isLocked?: boolean;
  uploadLabel: string;
  accept: string;
  assetType: HandleDataType.VIDEO | HandleDataType.AUDIO;
  onUpload: (asset: UploadedAsset) => void;
  onConnectToInput?: () => void;
}) {
  const { triggerUpload, uploadState } = useFileUpload({
    accept,
    assetType,
    onUpload,
  });
  return (
    <div className="relative px-4 py-2.5 border-b border-gray-50">
      <Handle
        type="target"
        position={Position.Left}
        id={handleId}
        style={{
          background: handleColor,
          width: 12,
          height: 12,
          border: "2.5px solid white",
          left: -6,
          top: "50%",
          transform: "translateY(-50%)",
          position: "absolute",
          boxShadow: `0 0 0 2px ${handleColor}33`,
        }}
      />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 flex-1">
          {label}
        </span>
        {isConnected ? (
          <div className="flex-1 px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-400 italic text-center">
            Connected
          </div>
        ) : (
          <button
            onClick={triggerUpload}
            disabled={isLocked || uploadState === "uploading"}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors disabled:opacity-40"
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
                {uploadLabel}
              </>
            )}
          </button>
        )}
        {onConnectToInput && (
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
        )}
      </div>
    </div>
  );
}

function GeminiNodeMenu({
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
    { label: isLocked ? "Unlock" : "Lock", action: onLock, disabled: false },
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

function SettingsSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-indigo-500"
      />
      <span className="text-xs text-gray-600 w-10 text-right">{value}</span>
    </div>
  );
}

export function GeminiNode({ id, data, selected }: NodeProps<GeminiNodeType>) {
  const updateNodeData = useWorkflowEditorStore((s) => s.updateNodeData);
  const nodes = useWorkflowEditorStore((s) => s.nodes);
  const setNodes = useWorkflowEditorStore((s) => s.setNodes);
  const edges = useEdges();
  const { addNodes, addEdges, getEdges } = useReactFlow();
  const [settingsOpen, setSettingsOpen] = useState(data.settingsOpen ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const streamingText = useExecutionStore((s) => s.streamingTexts.get(id));
  const isRunning = useWorkflowEditorStore((s) => s.isRunning);
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses.get(id) ?? "idle");
  const isPending =
    isRunning && (nodeStatus === "queued" || nodeStatus === "idle");
  const isNodeRunning = nodeStatus === "running" || nodeStatus === "streaming";
  const { runSingle } = useWorkflowExecution();
  const imageAssets: UploadedAsset[] =
    (data as any).imageAssets ?? (data.imageAsset ? [data.imageAsset] : []);
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
  const settings = data.settings ?? {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    topK: 40,
    jsonMode: false,
    reasoning: false,
  };

  // Resolve the current value flowing into a connected handle from upstream node data
  function getConnectedValue(handleId: string): string | undefined {
    if (!nodes) return undefined;
    const edge = edges.find(
      (e) => e.target === id && e.targetHandle === handleId,
    );
    if (!edge) return undefined;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return undefined;
    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceNode.type === "request-inputs") {
      const fields = sourceData.fields as
        | Array<{ id: string; value?: string; label?: string }>
        | undefined;
      const field = fields?.find((f) => f.id === edge.sourceHandle);
      return field?.value ?? undefined;
    }
    if (sourceNode.type === "gemini") {
      return sourceData.response as string | undefined;
    }
    return undefined;
  }

  function handleConnectPromptToInput() {
    if (!nodes) return;
    const inputNode = nodes.find((n) => n.id === "request-inputs");
    if (!inputNode) return;
    const currentFields = (inputNode.data as any).fields ?? [];
    let label = "prompt";
    const usedLabels = new Set(currentFields.map((f: any) => f.label));
    if (usedLabels.has(label)) {
      let n = 2;
      while (usedLabels.has(`${label}_${n}`)) n++;
      label = `${label}_${n}`;
    }
    const newFieldId = `text_field_${nanoid(6)}`;
    setNodes(
      nodes.map((n) =>
        n.id !== "request-inputs"
          ? n
          : {
              ...n,
              data: {
                ...n.data,
                fields: [
                  ...currentFields,
                  { id: newFieldId, label, type: "text", value: "" },
                ],
              },
            },
      ) as typeof nodes,
    );
    addEdges([
      {
        id: `e-${newFieldId}-${id}-prompt`,
        source: "request-inputs",
        sourceHandle: newFieldId,
        target: id,
        targetHandle: "prompt",
        type: "default",
      },
    ]);
  }

  function handleConnectImageToInput() {
    if (!nodes) return;
    const inputNode = nodes.find((n) => n.id === "request-inputs");
    if (!inputNode) return;
    const currentFields = (inputNode.data as any).fields ?? [];
    const prefix = "image_field";
    let label = prefix;
    const usedLabels = new Set(currentFields.map((f: any) => f.label));
    if (usedLabels.has(label)) {
      let n = 2;
      while (usedLabels.has(`${prefix}_${n}`)) n++;
      label = `${prefix}_${n}`;
    }
    const newFieldId = `${prefix}_${nanoid(6)}`;
    setNodes(
      nodes.map((n) =>
        n.id !== "request-inputs"
          ? n
          : {
              ...n,
              data: {
                ...n.data,
                fields: [
                  ...currentFields,
                  { id: newFieldId, label, type: "image", asset: null },
                ],
              },
            },
      ) as typeof nodes,
    );
    addEdges([
      {
        id: `e-${newFieldId}-${id}-image-vision`,
        source: "request-inputs",
        sourceHandle: newFieldId,
        target: id,
        targetHandle: "image-vision",
        type: "default",
      },
    ]);
  }

  function handleDuplicate(withEdges = false) {
    if (!nodes) return;
    const newId = nanoid(8);
    const currentNode = nodes.find((n) => n.id === id);
    if (!currentNode) return;
    addNodes([
      {
        ...currentNode,
        id: newId,
        position: {
          x: currentNode.position.x + 40,
          y: currentNode.position.y + 40,
        },
        selected: false,
        data: { ...currentNode.data },
      },
    ]);
    if (withEdges) {
      const currentEdges = getEdges();
      addEdges(
        currentEdges
          .filter((e) => e.source === id || e.target === id)
          .map((e) => ({
            ...e,
            id: `${e.id}-copy-${nanoid(4)}`,
            source: e.source === id ? newId : e.source,
            target: e.target === id ? newId : e.target,
          })),
      );
    }
  }

  function handleDelete() {
    if (!nodes) return;
    setNodes(nodes.filter((n) => n.id !== id) as typeof nodes);
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-visible transition-all duration-150"
      style={{
        minWidth: 300,
        maxWidth: 340,
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
            Gemini 3.1 Pro
          </span>
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
                Generate text with Google Gemini AI
              </div>
            )}
          </div>
          <button
            onClick={() =>
              update({
                settings: {
                  temperature: 0.7,
                  maxTokens: 2048,
                  topP: 0.9,
                  topK: 40,
                  jsonMode: false,
                  reasoning: false,
                },
              })
            }
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Reset settings"
          >
            {/* Circular arrow reset icon — matches Galaxy.ai reference */}
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
                  className="w-3 h-3 animate-spin"
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
              <GeminiNodeMenu
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
      {/* Prompt */}
      <TextInputRow
        label="Prompt"
        handleId="prompt"
        handleColor="#f97316"
        isConnected={connectedHandles.has("prompt")}
        connectedValue={getConnectedValue("prompt")}
        value={data.prompt}
        onChange={(v) => update({ prompt: v })}
        placeholder="Enter your prompt..."
        required
        isLocked={isLocked}
        showPlus
        onConnectToInput={handleConnectPromptToInput}
      />
      {/* System Prompt — no + */}
      <TextInputRow
        label="System Prompt"
        handleId="system-prompt"
        handleColor="#f97316"
        isConnected={connectedHandles.has("system-prompt")}
        connectedValue={getConnectedValue("system-prompt")}
        value={data.systemPrompt}
        onChange={(v) => update({ systemPrompt: v })}
        placeholder="System instructions..."
        isLocked={isLocked}
        showPlus={false}
      />
      {/* Image Vision */}
      <div className="relative px-4 py-2.5 border-b border-gray-50">
        <Handle
          type="target"
          position={Position.Left}
          id="image-vision"
          style={{
            background: "#3b82f6",
            width: 12,
            height: 12,
            border: "2.5px solid white",
            left: -6,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: "0 0 0 2px rgba(59,130,246,0.2)",
          }}
        />
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700">
            Image (Vision)
          </span>
          <button
            onClick={handleConnectImageToInput}
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
        </div>
        {connectedHandles.has("image-vision") ? (
          // Show actual upstream images from connected nodes
          (() => {
            const connectedImages = edges
              .filter(
                (e) => e.target === id && e.targetHandle === "image-vision",
              )
              .map((e) => {
                const srcNode = nodes.find((n) => n.id === e.source);
                if (!srcNode) return null;
                const srcData = srcNode.data as Record<string, unknown>;
                // crop-image output
                if (srcNode.type === "crop-image")
                  return srcData.outputImageUrl as string | null;
                // request-inputs image field
                if (srcNode.type === "request-inputs") {
                  const fields = srcData.fields as
                    | Array<{ id: string; asset?: { url: string } | null }>
                    | undefined;
                  const field = fields?.find((f) => f.id === e.sourceHandle);
                  return field?.asset?.url ?? null;
                }
                return null;
              })
              .filter(Boolean) as string[];

            return (
              <div className="flex flex-wrap gap-2">
                {connectedImages.length > 0 ? (
                  connectedImages.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={String(i + 1)}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/60 text-white text-[9px] font-bold rounded flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400 italic py-1">
                    Images will appear here when upstream nodes complete
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <MultiImageUpload
            images={imageAssets}
            isConnected={false}
            isLocked={isLocked}
            onAdd={(asset) => {
              const current: UploadedAsset[] =
                (data as any).imageAssets ??
                (data.imageAsset ? [data.imageAsset] : []);
              update({ imageAssets: [...current, asset], imageAsset: asset });
            }}
            onRemove={(index) => {
              const current: UploadedAsset[] = (data as any).imageAssets ?? [];
              const next = current.filter((_, i) => i !== index);
              update({ imageAssets: next, imageAsset: next[0] ?? null });
            }}
          />
        )}
      </div>
      {/* Video */}
      <MediaRow
        label="Video"
        handleId="video"
        handleColor="#a855f7"
        isConnected={connectedHandles.has("video")}
        isLocked={isLocked}
        uploadLabel="Upload video"
        accept="video/mp4,video/webm"
        assetType={HandleDataType.VIDEO}
        onUpload={(asset) => update({ videoAsset: asset })}
      />
      {/* Audio */}
      <MediaRow
        label="Audio"
        handleId="audio"
        handleColor="#22c55e"
        isConnected={connectedHandles.has("audio")}
        isLocked={isLocked}
        uploadLabel="Upload audio"
        accept="audio/mp3,audio/wav,audio/ogg,audio/m4a"
        assetType={HandleDataType.AUDIO}
        onUpload={(asset) => update({ audioAsset: asset })}
      />
      {/* Settings */}
      <div className="border-b border-gray-100">
        <button
          onClick={() => {
            setSettingsOpen((v) => !v);
            update({ settingsOpen: !settingsOpen });
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${settingsOpen ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span>Settings</span>
        </button>
        {settingsOpen && (
          <div className="pb-2">
            <SettingsSlider
              label="Temperature"
              value={settings.temperature ?? 0.7}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) =>
                update({ settings: { ...settings, temperature: v } })
              }
            />
            <SettingsSlider
              label="Max Tokens"
              value={settings.maxTokens ?? 2048}
              min={256}
              max={8192}
              step={256}
              onChange={(v) =>
                update({ settings: { ...settings, maxTokens: v } })
              }
            />
            <SettingsSlider
              label="Top P"
              value={settings.topP ?? 0.9}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => update({ settings: { ...settings, topP: v } })}
            />
            <SettingsSlider
              label="Top K"
              value={settings.topK ?? 40}
              min={1}
              max={100}
              step={1}
              onChange={(v) => update({ settings: { ...settings, topK: v } })}
            />
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className="text-xs text-gray-500 w-24">JSON Mode</span>
              <input
                type="checkbox"
                checked={settings.jsonMode ?? false}
                onChange={(e) =>
                  update({
                    settings: { ...settings, jsonMode: e.target.checked },
                  })
                }
                className="accent-indigo-500"
              />
            </div>
          </div>
        )}
      </div>
      {/* Response */}
      <div className="relative px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-sm font-medium text-gray-700">Response</span>
          {streamingText && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-violet-500 font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Streaming
            </span>
          )}
        </div>
        {/* Scrollable textarea-style output — user can copy content */}
        <div
          className={`rounded-xl border transition-colors ${streamingText ? "bg-violet-50 border-violet-100" : "bg-gray-50 border-gray-100"}`}
        >
          <textarea
            readOnly
            value={streamingText ?? data.response ?? ""}
            placeholder="No output yet"
            rows={5}
            className={`w-full px-3 py-2.5 text-sm rounded-xl resize-none outline-none bg-transparent cursor-text ${
              streamingText
                ? "text-gray-700"
                : data.response
                  ? "text-gray-700"
                  : "text-gray-400 italic"
            }`}
            style={{ minHeight: 60 }}
          />
          {streamingText && (
            <span className="inline-block w-0.5 h-3 bg-violet-500 ml-1 mb-1 animate-pulse align-middle" />
          )}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="response"
          style={{
            background: "#f97316",
            width: 12,
            height: 12,
            border: "2.5px solid white",
            right: -6,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: "0 0 0 2px rgba(249,115,22,0.2)",
          }}
        />
        <p className="text-right text-[10px] text-gray-400 mt-2">⚙ ~0.0001M</p>
      </div>
    </div>
  );
}
