// ─── Provider-agnostic AI execution types ────────────────────────────────────
// Architecture supports Gemini, OpenAI, Claude, Grok, DeepSeek, local models

export type AIProvider = "gemini" | "openai" | "claude" | "grok" | "deepseek";

export interface AIImageInput {
  /** URL (http/https) or base64 data URL */
  url: string;
  mimeType?: string;
}

export interface AIExecutionPayload {
  provider: AIProvider;
  model: string;
  prompt: string;
  systemPrompt?: string;
  images?: AIImageInput[];
  // Future media inputs (architecture-ready)
  videoUrl?: string | null;
  audioUrl?: string | null;
  fileUrl?: string | null;
  settings?: AIExecutionSettings;
}

export interface AIExecutionSettings {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequence?: string;
  // Future flags
  jsonMode?: boolean;
  reasoning?: boolean;
}

export interface AIExecutionResult {
  response: string;
  model: string;
  provider: AIProvider;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIExecutionError {
  code:
    | "rate_limit"
    | "invalid_payload"
    | "empty_prompt"
    | "api_error"
    | "asset_error";
  message: string;
  retryable: boolean;
}
