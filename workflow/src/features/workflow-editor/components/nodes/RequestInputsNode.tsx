"use client";

import { useState, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { nanoid } from "nanoid";
import type {
  RequestInputsNode as RequestInputsNodeType,
  InputField,
  UploadedAsset,
} from "../../types";
import { HandleDataType } from "../../types";
import { HANDLE_COLORS } from "../../constants";
import { useWorkflowEditorStore } from "../../store/workflowEditorStore";
import { ImageUploadArea } from "../ImageUploadArea";

// ─── Expand modal for text field ──────────────────────────────────────────────

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
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400"
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

// ─── Field type picker ────────────────────────────────────────────────────────

function FieldTypePicker({
  onSelect,
  onClose,
}: {
  onSelect: (type: HandleDataType.TEXT | HandleDataType.IMAGE) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 w-40 overflow-hidden">
      <button
        onClick={() => {
          onSelect(HandleDataType.TEXT);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {/* Text icon — three lines */}
        <svg
          className="w-4 h-4 text-gray-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 6h16M4 10h16M4 14h10"
          />
        </svg>
        Text
      </button>
      <button
        onClick={() => {
          onSelect(HandleDataType.IMAGE);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {/* Image icon */}
        <svg
          className="w-4 h-4 text-gray-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Image
      </button>
    </div>
  );
}

// ─── Text field row ───────────────────────────────────────────────────────────

function TextFieldRow({
  field,
  onRename,
  onDelete,
  onValueChange,
  onDuplicate,
}: {
  field: InputField;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onValueChange: (id: string, value: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(field.label);
  const [isHovered, setIsHovered] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);

  const handleLabelBlur = () => {
    setIsEditingLabel(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== field.label) onRename(field.id, trimmed);
    else setEditValue(field.label);
  };

  return (
    <>
      {expandOpen && (
        <ExpandModal
          label={field.label}
          value={field.value ?? ""}
          onChange={(v) => onValueChange(field.id, v)}
          onClose={() => setExpandOpen(false)}
        />
      )}

      <div
        className="relative px-3 py-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Drag handle + label row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {/* Drag dots */}
          <svg
            className="w-3 h-3 text-gray-300 flex-shrink-0 cursor-grab"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <circle cx="7" cy="6" r="1.2" />
            <circle cx="13" cy="6" r="1.2" />
            <circle cx="7" cy="10" r="1.2" />
            <circle cx="13" cy="10" r="1.2" />
            <circle cx="7" cy="14" r="1.2" />
            <circle cx="13" cy="14" r="1.2" />
          </svg>

          {/* Label — editable inline on pencil click */}
          {isEditingLabel ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setEditValue(field.label);
                  setIsEditingLabel(false);
                }
              }}
              className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-b-2 border-indigo-500 outline-none min-w-0"
            />
          ) : (
            <span
              className={`flex-1 text-sm font-medium truncate min-w-0 transition-colors ${isHovered ? "text-indigo-600" : "text-gray-700"}`}
            >
              {field.label}
            </span>
          )}

          {/* Pencil — on hover */}
          {isHovered && !isEditingLabel && (
            <button
              onClick={() => {
                setIsEditingLabel(true);
                setEditValue(field.label);
              }}
              className="p-0.5 text-gray-400 hover:text-indigo-500 transition-colors flex-shrink-0"
              title="Rename field"
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          )}

          {/* Info icon */}
          <button
            className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
            title={`Field ID: ${field.id}`}
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Copy + Delete — always visible */}
          <button
            onClick={() => onDuplicate(field.id)}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="Duplicate field"
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(field.id)}
            className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Delete field"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

        {/* Textarea with expand button */}
        <div className="relative">
          <textarea
            value={field.value ?? ""}
            onChange={(e) => onValueChange(field.id, e.target.value)}
            placeholder={`Enter ${field.label}...`}
            rows={3}
            className="nodrag w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder:text-gray-300 resize-none outline-none focus:border-gray-300 focus:bg-white transition-colors"
          />
          {/* Expand button — bottom right */}
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

        {/* Output handle — placed OUTSIDE nodrag wrapper so it can be dragged to connect */}
        <Handle
          type="source"
          position={Position.Right}
          id={field.id}
          style={{
            background: HANDLE_COLORS[HandleDataType.TEXT],
            width: 12,
            height: 12,
            border: "2.5px solid white",
            right: -6,
            top: "50%",
            transform: "translateY(-50%)",
            position: "absolute",
            boxShadow: "0 0 0 1px rgba(249,115,22,0.3)",
            zIndex: 10,
          }}
        />
      </div>
    </>
  );
}

// ─── Image field row ──────────────────────────────────────────────────────────

function ImageFieldRow({
  field,
  onRename,
  onDelete,
  onAssetChange,
  onDuplicate,
}: {
  field: InputField;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onAssetChange: (id: string, asset: UploadedAsset | null) => void;
  onDuplicate: (id: string) => void;
}) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(field.label);
  const [isHovered, setIsHovered] = useState(false);

  const handleLabelBlur = () => {
    setIsEditingLabel(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== field.label) onRename(field.id, trimmed);
    else setEditValue(field.label);
  };

  return (
    <div
      className="relative px-3 py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg
          className="w-3 h-3 text-gray-300 flex-shrink-0 cursor-grab"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="7" cy="6" r="1.2" />
          <circle cx="13" cy="6" r="1.2" />
          <circle cx="7" cy="10" r="1.2" />
          <circle cx="13" cy="10" r="1.2" />
          <circle cx="7" cy="14" r="1.2" />
          <circle cx="13" cy="14" r="1.2" />
        </svg>

        {isEditingLabel ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setEditValue(field.label);
                setIsEditingLabel(false);
              }
            }}
            className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-b-2 border-indigo-500 outline-none min-w-0"
          />
        ) : (
          <span
            className={`flex-1 text-sm font-medium truncate min-w-0 transition-colors ${isHovered ? "text-indigo-600" : "text-gray-700"}`}
          >
            {field.label}
          </span>
        )}

        {isHovered && !isEditingLabel && (
          <button
            onClick={() => {
              setIsEditingLabel(true);
              setEditValue(field.label);
            }}
            className="p-0.5 text-gray-400 hover:text-indigo-500 transition-colors flex-shrink-0"
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
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        )}

        <button
          className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          title={`Field ID: ${field.id}`}
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        <button
          onClick={() => onDuplicate(field.id)}
          className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Duplicate"
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          title="Delete"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      <ImageUploadArea
        asset={field.asset}
        isConnected={false}
        onUpload={(asset) => onAssetChange(field.id, asset)}
        onRemove={() => onAssetChange(field.id, null)}
        accept="image/jpeg,image/png,image/webp,image/gif"
        label="Upload Image"
      />

      <Handle
        type="source"
        position={Position.Right}
        id={field.id}
        style={{
          background: HANDLE_COLORS[HandleDataType.IMAGE],
          width: 12,
          height: 12,
          border: "2.5px solid white",
          right: -6,
          top: "50%",
          transform: "translateY(-50%)",
          position: "absolute",
          boxShadow: "0 0 0 1px rgba(59,130,246,0.3)",
        }}
      />
    </div>
  );
}

// ─── RequestInputs Node ───────────────────────────────────────────────────────

export function RequestInputsNode({
  id,
  data,
  selected,
}: NodeProps<RequestInputsNodeType>) {
  const setNodes = useWorkflowEditorStore((s) => s.setNodes);
  const nodes = useWorkflowEditorStore((s) => s.nodes);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const updateFields = useCallback(
    (updater: (fields: InputField[]) => InputField[]) => {
      if (!nodes) return;
      setNodes(
        nodes.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              fields: updater(
                (n.data as { fields: InputField[] }).fields ?? [],
              ),
            },
          };
        }) as typeof nodes,
      );
    },
    [id, nodes, setNodes],
  );

  // Smart default naming: text_field, text_field_2, text_field_3...
  const handleAddField = (type: HandleDataType.TEXT | HandleDataType.IMAGE) => {
    const allFields = data.fields ?? [];
    const prefix = type === HandleDataType.IMAGE ? "image_field" : "text_field";
    const sameType = allFields.filter((f) => f.type === type);

    let label: string;
    if (sameType.length === 0) {
      label = prefix;
    } else {
      // Find the next available number
      const usedLabels = new Set(allFields.map((f) => f.label));
      let n = 2;
      while (usedLabels.has(`${prefix}_${n}`)) n++;
      label = `${prefix}_${n}`;
    }

    const newField: InputField = {
      id: `${prefix}_${nanoid(6)}`,
      label,
      type,
      value: type === HandleDataType.TEXT ? "" : undefined,
      asset: type === HandleDataType.IMAGE ? null : undefined,
    };
    updateFields((fields) => [...fields, newField]);
  };

  const handleRename = (fieldId: string, label: string) => {
    updateFields((fields) =>
      fields.map((f) => (f.id === fieldId ? { ...f, label } : f)),
    );
  };

  const handleDelete = (fieldId: string) => {
    updateFields((fields) => fields.filter((f) => f.id !== fieldId));
  };

  const handleValueChange = (fieldId: string, value: string) => {
    updateFields((fields) =>
      fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
    );
  };

  const handleAssetChange = (fieldId: string, asset: UploadedAsset | null) => {
    updateFields((fields) =>
      fields.map((f) => (f.id === fieldId ? { ...f, asset } : f)),
    );
  };

  const handleDuplicate = (fieldId: string) => {
    const field = (data.fields ?? []).find((f) => f.id === fieldId);
    if (!field) return;
    const newField: InputField = {
      ...field,
      id: `${field.type === HandleDataType.IMAGE ? "image_field" : "text_field"}_${nanoid(6)}`,
      label: `${field.label} copy`,
    };
    updateFields((fields) => {
      const idx = fields.findIndex((f) => f.id === fieldId);
      const next = [...fields];
      next.splice(idx + 1, 0, newField);
      return next;
    });
  };

  const fields: InputField[] = data.fields ?? [];

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-visible transition-all duration-150"
      style={{
        minWidth: 280,
        border: selected ? "2px solid #6366f1" : "1.5px solid #e5e7eb",
        boxShadow: selected
          ? "0 0 0 3px rgba(99,102,241,0.15)"
          : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            Request-Inputs
          </span>

          {/* Info icon with tooltip */}
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
                Define inputs for this workflow
              </div>
            )}
          </div>
        </div>

        {/* + button — square rounded, matching reference */}
        <div className="relative">
          <button
            onClick={() => setShowTypePicker((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600"
            title="Add field"
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

          {showTypePicker && (
            <FieldTypePicker
              onSelect={handleAddField}
              onClose={() => setShowTypePicker(false)}
            />
          )}
        </div>
      </div>

      {/* Fields — draggable */}
      <div className="divide-y divide-gray-50">
        {!fields || fields.length === 0 ? (
          <div className="px-4 py-4 text-xs text-gray-400 italic text-center">
            Click + to add a field
          </div>
        ) : (
          fields.map((field, index) =>
            field.type === HandleDataType.IMAGE ? (
              <div
                key={field.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("fieldIndex", String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const fromIndex = parseInt(
                    e.dataTransfer.getData("fieldIndex"),
                  );
                  if (isNaN(fromIndex) || fromIndex === index) return;
                  updateFields((f) => {
                    const next = [...f];
                    const [moved] = next.splice(fromIndex, 1);
                    next.splice(index, 0, moved);
                    return next;
                  });
                }}
              >
                <ImageFieldRow
                  field={field}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onAssetChange={handleAssetChange}
                  onDuplicate={handleDuplicate}
                />
              </div>
            ) : (
              <div
                key={field.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("fieldIndex", String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const fromIndex = parseInt(
                    e.dataTransfer.getData("fieldIndex"),
                  );
                  if (isNaN(fromIndex) || fromIndex === index) return;
                  updateFields((f) => {
                    const next = [...f];
                    const [moved] = next.splice(fromIndex, 1);
                    next.splice(index, 0, moved);
                    return next;
                  });
                }}
              >
                <TextFieldRow
                  field={field}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onValueChange={handleValueChange}
                  onDuplicate={handleDuplicate}
                />
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
