// ─── Lightweight execution metrics ───────────────────────────────────────────
// Tracks key runtime events without noisy console spam.
// Production: pipe to Datadog / Sentry / Vercel Analytics

export type MetricEvent =
  | "workflow.run.started"
  | "workflow.run.completed"
  | "workflow.run.failed"
  | "node.execution.started"
  | "node.execution.completed"
  | "node.execution.failed"
  | "upload.started"
  | "upload.completed"
  | "upload.failed"
  | "sse.subscriber.connected"
  | "sse.subscriber.disconnected"
  | "autosave.triggered"
  | "autosave.completed"
  | "autosave.failed";

interface MetricPayload {
  event: MetricEvent;
  workflowId?: string;
  runId?: string;
  nodeId?: string;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

/**
 * Track a metric event.
 * In development: silent (no console spam).
 * In production: send to analytics provider.
 */
export function trackMetric(payload: MetricPayload): void {
  if (process.env.NODE_ENV === "development") return;

  // Production: send to your analytics provider
  // Example: fetch('/api/metrics', { method: 'POST', body: JSON.stringify(payload) })
  // For now: no-op to keep logs clean
  void payload;
}

/**
 * Measure async operation duration and track it.
 */
export async function measureAsync<T>(
  event: MetricEvent,
  context: Omit<MetricPayload, "event" | "durationMs">,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    trackMetric({ event, ...context, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    trackMetric({
      event,
      ...context,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
