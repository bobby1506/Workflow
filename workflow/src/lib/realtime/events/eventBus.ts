import type { ExecutionEvent } from "../types";

// ─── In-memory event bus ──────────────────────────────────────────────────────
// Stores SSE response controllers keyed by workflowId.
// Each workflow can have multiple subscribers (multiple tabs/users).
// Uses a global singleton to survive Next.js hot reloads in dev.

type Subscriber = {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

type SubscriberMap = Map<string, Subscriber[]>;

declare global {
  // eslint-disable-next-line no-var
  var __nextflow_event_bus__: SubscriberMap | undefined;
}

function getBus(): SubscriberMap {
  if (!global.__nextflow_event_bus__) {
    global.__nextflow_event_bus__ = new Map();
  }
  return global.__nextflow_event_bus__;
}

/**
 * Register a new SSE subscriber for a workflow.
 * Returns an unsubscribe function.
 */
export function subscribe(
  workflowId: string,
  subscriberId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): () => void {
  const bus = getBus();
  const existing = bus.get(workflowId) ?? [];
  bus.set(workflowId, [...existing, { id: subscriberId, controller }]);

  return () => {
    const current = bus.get(workflowId) ?? [];
    bus.set(
      workflowId,
      current.filter((s) => s.id !== subscriberId),
    );
  };
}

/**
 * Emit an event to all subscribers of a workflow.
 */
export function emit(workflowId: string, event: ExecutionEvent): void {
  const bus = getBus();
  const subscribers = bus.get(workflowId) ?? [];

  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify(event)}\n\n`,
  );

  const dead: string[] = [];

  for (const sub of subscribers) {
    try {
      sub.controller.enqueue(encoded);
    } catch {
      // Controller is closed — mark for removal
      dead.push(sub.id);
    }
  }

  if (dead.length > 0) {
    bus.set(
      workflowId,
      subscribers.filter((s) => !dead.includes(s.id)),
    );
  }
}

/**
 * Get subscriber count for a workflow (for observability).
 */
export function getSubscriberCount(workflowId: string): number {
  return getBus().get(workflowId)?.length ?? 0;
}
