import type { AIExecutionPayload, AIExecutionSettings } from "../types";
import { resolveImageInputs } from "../resolvers/assetResolver";

export interface RawGeminiInputs {
  prompt: unknown;
  systemPrompt?: unknown;
  model?: unknown;
  images?: unknown[];
  settings?: AIExecutionSettings;
}

/**
 * Builds a normalized AIExecutionPayload from raw resolved node inputs.
 * Handles sanitization, image resolution, and settings normalization.
 */
export async function buildGeminiPayload(
  inputs: RawGeminiInputs,
): Promise<AIExecutionPayload> {
  const prompt = sanitizeText(inputs.prompt);
  const systemPrompt = sanitizeText(inputs.systemPrompt) || undefined;
  const model =
    typeof inputs.model === "string" ? inputs.model : "gemini-2.5-flash";

  // Resolve all image inputs to normalized base64 format
  const rawImages = Array.isArray(inputs.images) ? inputs.images : [];
  const images = await resolveImageInputs(rawImages);

  const settings = normalizeSettings(inputs.settings);

  return {
    provider: "gemini",
    model,
    prompt,
    systemPrompt,
    images: images.length > 0 ? images : undefined,
    settings,
  };
}

function sanitizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeSettings(
  settings: AIExecutionSettings | undefined,
): AIExecutionSettings {
  return {
    temperature: clamp(settings?.temperature ?? 0.7, 0, 2),
    maxTokens: clamp(settings?.maxTokens ?? 2048, 1, 65536),
    topP: clamp(settings?.topP ?? 0.9, 0, 1),
    topK: clamp(settings?.topK ?? 40, 1, 100),
    stopSequence: settings?.stopSequence,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
