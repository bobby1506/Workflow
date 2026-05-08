import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { subscribe } from "@/lib/realtime/events/eventBus";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * SSE endpoint — clients subscribe here to receive live execution events.
 * GET /api/workflows/[id]/events
 *
 * Streams Server-Sent Events for the duration of the connection.
 * Reconnect-safe: client can reconnect and resume.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: workflowId } = await params;
  const subscriberId = nanoid();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial connection confirmation
      const connected = new TextEncoder().encode(
        `data: ${JSON.stringify({ type: "connected", workflowId, subscriberId })}\n\n`,
      );
      controller.enqueue(connected);

      // Register subscriber
      const unsubscribe = subscribe(workflowId, subscriberId, controller);

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Store cleanup on controller for abort handling
      (controller as unknown as { _cleanup: () => void })._cleanup = cleanup;
    },

    cancel() {
      // Called when client disconnects
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
