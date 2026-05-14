import { task, logger, streams } from "@trigger.dev/sdk/v3";
import type { NodeTaskPayload, NodeTaskResult } from "../types";
import { buildGeminiPayload } from "../../lib/ai/payloads/geminiPayloadBuilder";
import { executeGeminiStreaming } from "../../lib/ai/providers/geminiStreamingProvider";
import type { AIExecutionSettings } from "../../lib/ai/types";

// ─── Gemini Trigger.dev task (with streaming) ─────────────────────────────────

export const geminiTask = task({
  id: "gemini-node-execute",
  maxDuration: 120,

  run: async (payload: NodeTaskPayload): Promise<NodeTaskResult> => {
    const { runId, workflowId, nodeId, inputs } = payload;

    logger.info("Gemini task started", {
      runId,
      workflowId,
      nodeId,
      model: inputs.model,
      hasImages:
        Array.isArray(inputs.images) && (inputs.images as unknown[]).length > 0,
    });

    const startTime = Date.now();
    const streamName = `gemini-response-${nodeId}`;

    // Define the stream for this node
    const stream = streams.define<string>({
      id: streamName,
    });

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

      // Stream tokens to Trigger.dev stream using writer
      let geminiResult: any = null;

      const { waitUntilComplete } = stream.writer({
        execute: async ({ write }) => {
          geminiResult = await executeGeminiStreaming(
            aiPayload,
            async (chunk) => {
              // Write each token chunk to the stream
              write(chunk);
            },
          );
        },
      });

      // Wait for all chunks to be written
      await waitUntilComplete();

      if (!geminiResult) {
        throw new Error("Gemini streaming failed: no result returned");
      }

      const result = geminiResult;

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

      return { nodeId, output, durationMs: actualDuration };
    } catch (err) {
      const actualDuration = Date.now() - startTime;
      const errorMsg = classifyError(err);

      logger.error("Gemini task failed", { runId, nodeId, error: errorMsg });

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
