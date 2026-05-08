import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { cropImageWithFFmpeg } from "@/lib/media/ffmpeg/cropProcessor";

const schema = z.object({
  imageUrl: z.string().min(1, "imageUrl is required"),
  x: z.number().min(0).max(100).default(0),
  y: z.number().min(0).max(100).default(0),
  width: z.number().min(1).max(100).default(100),
  height: z.number().min(1).max(100).default(100),
});

/**
 * POST /api/execute/crop
 * Server-side FFmpeg crop + Transloadit upload for the frontend orchestrator.
 * Called when running in local dev mode (no Trigger.dev).
 * Includes the mandatory 30-second delay per product spec.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { imageUrl, x, y, width, height } = parsed.data;


    // MANDATORY: 30+ second artificial delay per product spec
    await new Promise((r) => setTimeout(r, 30000));

    const startTime = Date.now();
    const result = await cropImageWithFFmpeg(imageUrl, { x, y, width, height });
    const durationMs = Date.now() - startTime + 30000;


    return NextResponse.json({
      outputImageUrl: result.outputUrl,
      "output-image": result.outputUrl,
      mimeType: result.mimeType,
      size: result.size,
      durationMs,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Crop execution failed";
    console.error(`[NextFlow API] ❌ Crop error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
