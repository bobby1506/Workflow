import type { Node, Edge, Viewport } from "@xyflow/react";

// ─── Node Type Enum ───────────────────────────────────────────────────────────

export enum NodeType {
  REQUEST_INPUTS = "request-inputs",
  RESPONSE = "response",
  GEMINI = "gemini",
  CROP_IMAGE = "crop-image",
}

// ─── Handle Data Type Enum ────────────────────────────────────────────────────

export enum HandleDataType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  FILE = "file",
  GENERIC = "generic",
}

// ─── Execution state ──────────────────────────────────────────────────────────

export type NodeExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "failed";

// ─── Uploaded asset ───────────────────────────────────────────────────────────

export interface UploadedAsset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type:
    | HandleDataType.IMAGE
    | HandleDataType.VIDEO
    | HandleDataType.AUDIO
    | HandleDataType.FILE;
  source: "transloadit" | "local";
}

// ─── Field definition for RequestInputs node ─────────────────────────────────

export interface InputField {
  id: string;
  label: string;
  type: HandleDataType.TEXT | HandleDataType.IMAGE;
  // text field value
  value?: string;
  // image field asset
  asset?: UploadedAsset | null;
}

// ─── Gemini settings ──────────────────────────────────────────────────────────

export interface GeminiSettings {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  jsonMode?: boolean;
  reasoning?: boolean;
  stopSequence?: string;
}

// ─── Node data interfaces ─────────────────────────────────────────────────────

export interface RequestInputsNodeData extends Record<string, unknown> {
  fields: InputField[];
  executionStatus?: NodeExecutionStatus;
}

export interface ResponseNodeData extends Record<string, unknown> {
  result?: string;
  executionStatus?: NodeExecutionStatus;
}

export interface GeminiNodeData extends Record<string, unknown> {
  label?: string;
  model: string;
  prompt?: string;
  systemPrompt?: string;
  // Uploaded assets for media inputs (used when not connected)
  imageAsset?: UploadedAsset | null;
  imageAssets?: UploadedAsset[];
  videoAsset?: UploadedAsset | null;
  audioAsset?: UploadedAsset | null;
  fileAsset?: UploadedAsset | null;
  settings?: GeminiSettings;
  settingsOpen?: boolean;
  response?: string;
  executionStatus?: NodeExecutionStatus;
}

export interface CropImageNodeData extends Record<string, unknown> {
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Uploaded image (used when input-image handle is not connected)
  imageAsset?: UploadedAsset | null;
  outputImageUrl?: string;
  executionStatus?: NodeExecutionStatus;
}

// ─── Typed node variants ──────────────────────────────────────────────────────

export type RequestInputsNode = Node<
  RequestInputsNodeData,
  NodeType.REQUEST_INPUTS
>;
export type ResponseNode = Node<ResponseNodeData, NodeType.RESPONSE>;
export type GeminiNode = Node<GeminiNodeData, NodeType.GEMINI>;
export type CropImageNode = Node<CropImageNodeData, NodeType.CROP_IMAGE>;

export type WorkflowNode =
  | RequestInputsNode
  | ResponseNode
  | GeminiNode
  | CropImageNode;

export type WorkflowEdge = Edge;

// ─── Workflow editor Zustand state ────────────────────────────────────────────

export interface WorkflowEditorState {
  workflowId: string;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: Viewport;
  isDirty: boolean;
  isSaving: boolean;
  // Execution state
  isRunning: boolean;
  runScope: "full" | "selected" | "single" | null;
  // Trigger.dev realtime state
  triggerRunId: string | null;
  publicToken: string | null;
}

// ─── Node picker item ─────────────────────────────────────────────────────────

export interface NodePickerItem {
  type: NodeType;
  label: string;
  description: string;
  category: NodePickerCategory;
  icon: string;
  functional: boolean;
}

export type NodePickerCategory =
  | "Recent"
  | "LLM"
  | "Image"
  | "Video"
  | "Audio"
  | "Others";
