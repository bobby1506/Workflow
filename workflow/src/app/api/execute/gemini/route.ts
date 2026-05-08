import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { buildGeminiPayload } from "@/lib/ai/payloads/geminiPayloadBuilder";
import { executeGeminiStreaming } from "@/lib/ai/providers/geminiStreamingProvider";

const schema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  systemPrompt: z.string().optional(),
  // gemini-2.5-flash: free tier 250 req/day, 1M tokens/day
  model: z.string().default("gemini-2.5-flash"),
  images: z.array(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * POST /api/execute/gemini
 * Server-side Gemini execution for the frontend orchestrator (local dev mode).
 * In production, execution goes through Trigger.dev tasks instead.
 * Uses gemini-2.5-flash by default — free tier: 250 req/day, 1M tokens/day.
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

    let { prompt, systemPrompt, model, images, settings } = parsed.data;

    // Normalize model name — use gemini-2.5-flash as the free-tier default
    // gemini-2.5-pro has 0 free quota; gemini-1.5-* are deprecated
    const deprecatedModels = [
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash-latest",
    ];
    const noFreeQuotaModels = ["gemini-2.5-pro"];

    if (deprecatedModels.includes(model)) {
      model = "gemini-2.5-flash";
    } else if (noFreeQuotaModels.includes(model)) {
      model = "gemini-2.5-flash";
    }


    const payload = await buildGeminiPayload({
      prompt,
      systemPrompt,
      model,
      images: images ?? [],
      settings: settings as any,
    });

    const startTime = Date.now();

    // Execute with retry on rate limit (up to 3 attempts)
    const executeWithRetry = async (
      attempt = 1,
    ): Promise<ReturnType<typeof executeGeminiStreaming>> => {
      try {
        return await executeGeminiStreaming(payload, async () => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
        const retryDelay = retryMatch
          ? parseFloat(retryMatch[1]) * 1000
          : 60000;

        if (
          (msg.includes("429") || msg.toLowerCase().includes("quota")) &&
          attempt < 3
        ) {
          await new Promise((r) => setTimeout(r, retryDelay));
          return executeWithRetry(attempt + 1);
        }
        throw err;
      }
    };

    const result = await executeWithRetry();
    const durationMs = Date.now() - startTime;


    return NextResponse.json({
      response: result.response,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gemini execution failed";
    console.error(`[NextFlow API] ❌ Gemini error:`, message);

    const isRateLimit =
      message.includes("429") || message.toLowerCase().includes("quota");
    const isNotFound =
      message.includes("404") || message.toLowerCase().includes("not found");

    return NextResponse.json(
      {
        error: isRateLimit
          ? "Gemini rate limit reached. Please wait a minute and try again."
          : isNotFound
            ? `Model not found. Try using gemini-2.5-flash instead. Original: ${message}`
            : message,
      },
      { status: isRateLimit ? 429 : isNotFound ? 404 : 500 },
    );
  }
}
