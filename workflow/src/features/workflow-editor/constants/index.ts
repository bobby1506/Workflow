import type { DefaultEdgeOptions } from "@xyflow/react";
import type { NodePickerItem } from "../types";
import { NodeType, HandleDataType } from "../types";

// ─── Non-deletable node IDs ───────────────────────────────────────────────────

export const NON_DELETABLE_NODES: string[] = ["request-inputs", "response"];

// ─── Default edge options ─────────────────────────────────────────────────────

export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  animated: false,
  type: "default",
  style: {
    stroke: "#6366f1",
    strokeWidth: 2,
    strokeDasharray: "none",
  },
};

// ─── Auto-save debounce delay (ms) ───────────────────────────────────────────

export const AUTOSAVE_DELAY = 1500;

// ─── Handle colors by data type ──────────────────────────────────────────────

export const HANDLE_COLORS: Record<string, string> = {
  [HandleDataType.TEXT]: "#f97316", // orange
  [HandleDataType.IMAGE]: "#3b82f6", // blue
  [HandleDataType.VIDEO]: "#a855f7", // purple
  [HandleDataType.AUDIO]: "#22c55e", // green
  [HandleDataType.FILE]: "#eab308", // yellow
  [HandleDataType.GENERIC]: "#6366f1", // indigo
};

// ─── Gemini models ────────────────────────────────────────────────────────────

export const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-8b", label: "Gemini 2.5 Flash 8B" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

// Default model — gemini-2.5-flash has free tier (250 req/day)
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// ─── Node picker catalog ──────────────────────────────────────────────────────

export const NODE_PICKER_ITEMS: NodePickerItem[] = [
  {
    type: NodeType.GEMINI,
    label: "Gemini 2.5 Pro",
    description: "Google's most capable multimodal LLM",
    category: "LLM",
    icon: "✦",
    functional: true,
  },
  {
    type: NodeType.CROP_IMAGE,
    label: "Crop Image",
    description: "Crop an image by percentage coordinates",
    category: "Image",
    icon: "✂",
    functional: true,
  },
  // Placeholder entries for other categories
  {
    type: NodeType.GEMINI,
    label: "Generate Image",
    description: "Generate images with AI",
    category: "Image",
    icon: "🖼",
    functional: false,
  },
  {
    type: NodeType.GEMINI,
    label: "Edit Image",
    description: "Edit images with AI",
    category: "Image",
    icon: "✏️",
    functional: false,
  },
  {
    type: NodeType.GEMINI,
    label: "Generate Video",
    description: "Generate video with AI",
    category: "Video",
    icon: "🎬",
    functional: false,
  },
  {
    type: NodeType.GEMINI,
    label: "Enhance Video",
    description: "Enhance video quality",
    category: "Video",
    icon: "✨",
    functional: false,
  },
  {
    type: NodeType.GEMINI,
    label: "Text to Speech",
    description: "Convert text to audio",
    category: "Audio",
    icon: "🔊",
    functional: false,
  },
  {
    type: NodeType.GEMINI,
    label: "Music Generation",
    description: "Generate music with AI",
    category: "Audio",
    icon: "🎵",
    functional: false,
  },
  {
    type: NodeType.GEMINI,
    label: "Sound Effects",
    description: "Generate sound effects",
    category: "Audio",
    icon: "🎧",
    functional: false,
  },
];

export const NODE_PICKER_CATEGORIES = [
  "Recent",
  "LLM",
  "Image",
  "Video",
  "Audio",
  "Others",
] as const;
