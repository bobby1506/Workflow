import { task, logger } from "@trigger.dev/sdk/v3";
import type { NodeTaskPayload, NodeTaskResult } from "../types";
import { cropImageWithFFmpeg } from "../../lib/media/ffmpeg/cropProcessor";
import { validateImageUrl } from "../../lib/media/utils/validation";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Crop Image Trigger.dev task ──────────────────────────────────────────────

export const cropImageTask = task({
  id: "crop-image-node-execute",
  maxDuration: 180, // 3 minutes — covers 30s delay + FFmpeg processing

  run: async (payload: NodeTaskPayload): Promise<NodeTaskResult> => {
    const { runId, workflowId, nodeId, inputs } = payload;

    logger.info("Crop Image task started", {
      runId,
      workflowId,
      nodeId,
      hasImage: !!inputs.imageUrl,
    });

    const startTime = Date.now();

    try {
      // Validate input image
      const imageUrl = inputs.imageUrl as string | undefined;
      if (!imageUrl) {
        throw new Error("Input Image is required but was not provided");
      }
      if (!validateImageUrl(imageUrl)) {
        throw new Error("Input Image URL is invalid or unsupported");
      }

      const x = Number(inputs.x ?? 0);
      const y = Number(inputs.y ?? 0);
      const width = Number(inputs.width ?? 100);
      const height = Number(inputs.height ?? 100);

      // Validate crop params
      if (width <= 0 || height <= 0) {
        throw new Error("Crop width and height must be greater than 0");
      }

      logger.info("Running FFmpeg crop", {
        nodeId,
        x,
        y,
        width,
        height,
        imageUrl: imageUrl.substring(0, 80),
      });

      // ─── MANDATORY: 30+ second artificial delay per product spec ─────────
      // This is a hard requirement — do not remove or reduce.
      await sleep(30000);

      // Run real FFmpeg crop
      const cropResult = await cropImageWithFFmpeg(imageUrl, {
        x,
        y,
        width,
        height,
      });

      const output: Record<string, unknown> = {
        outputImageUrl: cropResult.outputUrl,
        // Expose on the "output-image" handle for downstream connections
        "output-image": cropResult.outputUrl,
        mimeType: cropResult.mimeType,
        size: cropResult.size,
        cropParams: { x, y, width, height },
      };

      const actualDuration = Date.now() - startTime;

      logger.info("Crop Image task completed", {
        runId,
        nodeId,
        durationMs: actualDuration,
        outputUrl: cropResult.outputUrl.substring(0, 80),
      });

      return { nodeId, output, durationMs: actualDuration };
    } catch (err) {
      const actualDuration = Date.now() - startTime;
      const errorMsg =
        err instanceof Error ? err.message : "Crop execution failed";

      logger.error("Crop Image task failed", {
        runId,
        nodeId,
        error: errorMsg,
        durationMs: actualDuration,
      });

      throw new Error(errorMsg);
    }
  },
});
