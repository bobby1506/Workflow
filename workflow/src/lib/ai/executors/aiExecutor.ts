import type { AIExecutionPayload, AIExecutionResult } from "../types";
import { executeGemini } from "../providers/geminiProvider";

/**
 * Provider-agnostic AI executor.
 * Routes execution to the correct provider based on payload.provider.
 * Add new providers here without touching task code.
 */
export async function executeAI(
  payload: AIExecutionPayload,
): Promise<AIExecutionResult> {
  switch (payload.provider) {
    case "gemini":
      return executeGemini(payload);

    // Future providers — architecture ready
    // case "openai":
    //   return executeOpenAI(payload);
    // case "claude":
    //   return executeClaude(payload);

    default:
      throw new Error(`Unsupported AI provider: ${payload.provider}`);
  }
}
