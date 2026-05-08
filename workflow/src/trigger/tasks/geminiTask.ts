import { task, logger } from "@trigger.dev/sdk/v3";
import type { NodeTaskPayload, NodeTaskResult } from "../types";
import { buildGeminiPayload } from "../../lib/ai/payloads/geminiPayloadBuilder";
import { executeGeminiStreaming } from "../../lib/ai/providers/geminiStreamingProvider";
import type { AIExecutionSettings } from "../../lib/ai/types";

// ─── Gemini Trigger.dev task (with streaming) ─────────────────────────────────

export const geminiTask = task({
  id: "gemini-node-execute",
  maxDuration: 120,

  run: async (payload: NodeTaskPayload): Promise<NodeTaskResult> => {
    const { runId, workflowId, nodeId, inputs, callbackBaseUrl } = payload;

    logger.info("Gemini task started", {
      runId,
      workflowId,
      nodeId,
      model: inputs.model,
      hasImages:
        Array.isArray(inputs.images) && (inputs.images as unknown[]).length > 0,
    });

    await notifyNodeStatus(
      callbackBaseUrl,
      runId,
      nodeId,
      workflowId,
      "RUNNING",
      inputs,
    );

    const startTime = Date.now();

    try {
      const prompt = inputs.prompt as string | undefined;
      if (!prompt?.trim()) throw new Error("Prompt is required but was empty");

      const aiPayload = await buildGeminiPayload({
        prompt: inputs.prompt,
        systemPrompt: inputs.systemPrompt,
        model: inputs.model,
        images: inputs.images as unknown[],
        settings: inputs.settings as AIExecutionSettings | undefined,
      });

      logger.info("Executing Gemini API (streaming)", {
        nodeId,
        model: aiPayload.model,
        imageCount: aiPayload.images?.length ?? 0,
      });

      // Stream tokens — emit chunk events for live UI updates
      const result = await executeGeminiStreaming(
        aiPayload,
        async (chunk, accumulated) => {
          await notifyStreamChunk(
            callbackBaseUrl,
            runId,
            nodeId,
            workflowId,
            chunk,
            accumulated,
          );
        },
      );

      const output: Record<string, unknown> = {
        response: result.response,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };

      const actualDuration = Date.now() - startTime;

      logger.info("Gemini task completed", {
        runId,
        nodeId,
        durationMs: actualDuration,
        outputTokens: result.outputTokens,
      });

      await notifyNodeStatus(
        callbackBaseUrl,
        runId,
        nodeId,
        workflowId,
        "SUCCESS",
        inputs,
        output,
        undefined,
        actualDuration,
      );

      return { nodeId, output, durationMs: actualDuration };
    } catch (err) {
      const actualDuration = Date.now() - startTime;
      const errorMsg = classifyError(err);

      logger.error("Gemini task failed", { runId, nodeId, error: errorMsg });

      await notifyNodeStatus(
        callbackBaseUrl,
        runId,
        nodeId,
        workflowId,
        "FAILED",
        inputs,
        {},
        errorMsg,
        actualDuration,
      );

      throw new Error(errorMsg);
    }
  },
});

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.toLowerCase().includes("rate limit"))
    return "Rate limit exceeded — please try again in a moment";
  if (msg.includes("API_KEY") || msg.includes("api key"))
    return "Invalid or missing Gemini API key";
  if (msg.includes("SAFETY") || msg.toLowerCase().includes("safety"))
    return "Content blocked by Gemini safety filters";
  if (msg.includes("Prompt is required"))
    return "Prompt is required but was empty";
  return msg;
}

async function notifyNodeStatus(
  baseUrl: string,
  runId: string,
  nodeId: string,
  workflowId: string,
  status: "RUNNING" | "SUCCESS" | "FAILED",
  input: Record<string, unknown>,
  output?: Record<string, unknown>,
  error?: string,
  durationMs?: number,
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/internal/node-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      body: JSON.stringify({
        runId,
        nodeId,
        workflowId,
        status,
        input,
        output,
        error,
        durationMs,
      }),
    });
  } catch (err) {
    logger.warn("Failed to notify node status", { nodeId, status, err });
  }
}

async function notifyStreamChunk(
  baseUrl: string,
  runId: string,
  nodeId: string,
  workflowId: string,
  chunk: string,
  accumulated: string,
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/internal/node-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      body: JSON.stringify({
        runId,
        nodeId,
        workflowId,
        status: "STREAMING",
        chunk,
        partialResponse: accumulated,
      }),
    });
  } catch {
    // Non-critical — streaming chunks are best-effort
  }
}
