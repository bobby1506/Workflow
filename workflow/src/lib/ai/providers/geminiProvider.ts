import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerationConfig,
  type Part,
} from "@google/generative-ai";
import type { AIExecutionPayload, AIExecutionResult } from "../types";

// ─── Gemini provider ──────────────────────────────────────────────────────────

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Safety settings — permissive for creative/marketing content
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

/**
 * Execute a real Gemini API call with the given payload.
 * Supports text-only and multimodal (text + images) inputs.
 */
export async function executeGemini(
  payload: AIExecutionPayload,
): Promise<AIExecutionResult> {
  if (!payload.prompt) {
    throw new Error("Prompt is required for Gemini execution");
  }

  const startTime = Date.now();
  const client = getClient();

  const generationConfig: GenerationConfig = {
    temperature: payload.settings?.temperature ?? 0.7,
    maxOutputTokens: payload.settings?.maxTokens ?? 2048,
    topP: payload.settings?.topP ?? 0.9,
    topK: payload.settings?.topK ?? 40,
    ...(payload.settings?.stopSequence && {
      stopSequences: [payload.settings.stopSequence],
    }),
  };

  const model = client.getGenerativeModel({
    model: payload.model,
    generationConfig,
    safetySettings: SAFETY_SETTINGS,
    ...(payload.systemPrompt && {
      systemInstruction: payload.systemPrompt,
    }),
  });

  // Build content parts
  const parts: Part[] = [];

  // Add images first (multimodal)
  if (payload.images && payload.images.length > 0) {
    for (const image of payload.images) {
      const match = image.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
  }

  // Add text prompt
  parts.push({ text: payload.prompt });

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const response = result.response;
  const text = response.text();

  const durationMs = Date.now() - startTime;

  return {
    response: text,
    model: payload.model,
    provider: "gemini",
    durationMs,
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
  };
}
