import type { ResolvedInputs } from "./inputResolver";

// ─── Execution result ─────────────────────────────────────────────────────────

export interface ExecutionResult {
  output: Record<string, unknown>;
  durationMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Gemini executor ──────────────────────────────────────────────────────────
// Calls the server-side /api/execute/gemini route.
// This runs in the browser — we CANNOT use process.env or import server packages.

export async function executeMockGemini(
  inputs: ResolvedInputs,
): Promise<ExecutionResult> {
  const prompt = inputs.prompt as string | undefined;
  if (!prompt?.trim()) {
    throw new Error("Prompt is required but was empty");
  }


  const startTime = Date.now();

  const res = await fetch("/api/execute/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: inputs.prompt,
      systemPrompt: inputs.systemPrompt,
      model: inputs.model ?? "gemini-2.5-flash",
      images: inputs.images ?? [],
      settings: inputs.settings,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Unknown error" }));
    const msg = errData.error ?? `Gemini API error ${res.status}`;
    console.error(`[NextFlow] ❌ Gemini server API failed:`, msg);
    throw new Error(msg);
  }

  const data = await res.json();
  const durationMs = Date.now() - startTime;


  return {
    output: {
      response: data.response,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
    },
    durationMs,
  };
}

// ─── Crop Image executor ──────────────────────────────────────────────────────
// Calls the server-side /api/execute/crop route.
// FFmpeg and Transloadit run server-side — NEVER import them here (browser).

export async function executeMockCropImage(
  inputs: ResolvedInputs,
): Promise<ExecutionResult> {
  const imageUrl = inputs.imageUrl as string | undefined;
  if (!imageUrl) {
    throw new Error("Input Image is required but was not provided");
  }


  const startTime = Date.now();

  const res = await fetch("/api/execute/crop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl,
      x: inputs.x ?? 0,
      y: inputs.y ?? 0,
      width: inputs.width ?? 100,
      height: inputs.height ?? 100,
    }),
    // 3 minute timeout — covers 30s delay + FFmpeg processing
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Unknown error" }));
    const msg = errData.error ?? `Crop API error ${res.status}`;
    console.error(`[NextFlow] ❌ Crop server API failed:`, msg);
    throw new Error(msg);
  }

  const data = await res.json();
  const durationMs = Date.now() - startTime;


  return {
    output: {
      outputImageUrl: data.outputImageUrl,
      "output-image": data.outputImageUrl,
      mimeType: data.mimeType,
      size: data.size,
    },
    durationMs,
  };
}

// ─── Request-Inputs executor ──────────────────────────────────────────────────

export async function executeMockRequestInputs(
  inputs: ResolvedInputs,
): Promise<ExecutionResult> {
  await sleep(100);
  return { output: { ...inputs }, durationMs: 100 };
}

// ─── Response executor ────────────────────────────────────────────────────────

export async function executeMockResponse(
  inputs: ResolvedInputs,
): Promise<ExecutionResult> {
  await sleep(100);
  return { output: { result: inputs.result ?? null }, durationMs: 100 };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeNode(
  nodeType: string,
  inputs: ResolvedInputs,
): Promise<ExecutionResult> {
  switch (nodeType) {
    case "gemini":
      return executeMockGemini(inputs);
    case "crop-image":
      return executeMockCropImage(inputs);
    case "request-inputs":
      return executeMockRequestInputs(inputs);
    case "response":
      return executeMockResponse(inputs);
    default:
      await sleep(500);
      return { output: {}, durationMs: 500 };
  }
}
