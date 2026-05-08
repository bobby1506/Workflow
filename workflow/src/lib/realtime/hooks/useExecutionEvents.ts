"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ExecutionEvent, SubscriptionOptions } from "../types";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

/**
 * Subscribe to live execution events for a workflow via SSE.
 * Automatically reconnects on disconnect with exponential backoff.
 * Deduplicates events by eventId.
 */
export function useExecutionEvents({
  workflowId,
  onEvent,
  onError,
  onReconnect,
}: SubscriptionOptions) {
  const esRef = useRef<EventSource | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = useRef(true);

  const connect = useCallback(() => {
    if (!workflowId || !isActive.current) return;

    const url = `/api/workflows/${workflowId}/events`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExecutionEvent & {
          eventId?: string;
        };

        // Skip connection confirmation messages
        if ((data as { type: string }).type === "connected") return;

        // Deduplicate
        if (data.eventId) {
          if (seenEventIds.current.has(data.eventId)) return;
          seenEventIds.current.add(data.eventId);
          // Keep set bounded
          if (seenEventIds.current.size > 1000) {
            const arr = [...seenEventIds.current];
            seenEventIds.current = new Set(arr.slice(-500));
          }
        }

        onEvent(data);
        reconnectAttempts.current = 0; // Reset on successful message
      } catch {
        // Malformed event — ignore
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (!isActive.current) return;

      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        onError?.(new Error("SSE connection failed after max retries"));
        return;
      }

      const delay =
        RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts.current);
      reconnectAttempts.current++;

      reconnectTimer.current = setTimeout(() => {
        if (isActive.current) {
          onReconnect?.();
          connect();
        }
      }, delay);
    };
  }, [workflowId, onEvent, onError, onReconnect]);

  useEffect(() => {
    isActive.current = true;
    connect();

    return () => {
      isActive.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
