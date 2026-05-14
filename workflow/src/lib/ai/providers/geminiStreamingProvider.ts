import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerationConfig,
  type Part,
} from "@google/generative-ai";
import type { AIExecutionPayload, AIExecutionResult } from "../types";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

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
 * Execute Gemini with streaming, calling onChunk for each token chunk.
 * Used by the Trigger.dev task to emit live streaming events.
 */
export async function executeGeminiStreaming(
  payload: AIExecutionPayload,
  onChunk: (chunk: string) => Promise<void>,
): Promise<AIExecutionResult> {
  if (!payload.prompt) throw new Error("Prompt is required");

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
    ...(payload.systemPrompt && { systemInstruction: payload.systemPrompt }),
  });

  const parts: Part[] = [];

  if (payload.images?.length) {
    for (const image of payload.images) {
      const match = image.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
  }

  parts.push({ text: payload.prompt });

  const streamResult = await model.generateContentStream({
    contents: [{ role: "user", parts }],
  });

  let accumulated = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  for await (const chunk of streamResult.stream) {
    const text = chunk.text();
    if (text) {
      accumulated += text;
      await onChunk(text);
    }
  }

  // Get final metadata
  const finalResponse = await streamResult.response;
  inputTokens = finalResponse.usageMetadata?.promptTokenCount;
  outputTokens = finalResponse.usageMetadata?.candidatesTokenCount;

  const durationMs = Date.now() - startTime;

  return {
    response: accumulated,
    model: payload.model,
    provider: "gemini",
    durationMs,
    inputTokens,
    outputTokens,
  };
}
