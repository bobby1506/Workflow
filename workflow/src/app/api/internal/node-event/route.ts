import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { NodeRunStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { executionEmitter } from "@/lib/realtime/emitters/executionEmitter";

const nodeEventSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  workflowId: z.string().optional(),
  status: z.enum([
    "QUEUED",
    "RUNNING",
    "STREAMING",
    "SUCCESS",
    "FAILED",
    "SKIPPED",
  ]),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
  // Streaming-specific
  partialResponse: z.string().optional(),
  chunk: z.string().optional(),
});

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = nodeEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    runId,
    nodeId,
    status,
    input,
    output,
    error,
    durationMs,
    partialResponse,
    chunk,
  } = parsed.data;

  // Resolve workflowId for SSE emission
  let workflowId = parsed.data.workflowId;
  if (!workflowId) {
    const run = await db.run.findUnique({
      where: { id: runId },
      select: { workflowId: true },
    });
    workflowId = run?.workflowId;
  }

  try {
    const statusMap: Record<string, NodeRunStatus> = {
      QUEUED: NodeRunStatus.PENDING,
      RUNNING: NodeRunStatus.RUNNING,
      STREAMING: NodeRunStatus.RUNNING,
      SUCCESS: NodeRunStatus.SUCCESS,
      FAILED: NodeRunStatus.FAILED,
      SKIPPED: NodeRunStatus.FAILED,
    };

    // ─── Emit SSE event ───────────────────────────────────────────────────────
    if (workflowId) {
      switch (status) {
        case "QUEUED":
          executionEmitter.nodeQueued(workflowId, runId, nodeId, "unknown");
          break;
        case "RUNNING":
          executionEmitter.nodeRunning(
            workflowId,
            runId,
            nodeId,
            "unknown",
            input ?? {},
          );
          break;
        case "STREAMING":
          if (chunk !== undefined && partialResponse !== undefined) {
            executionEmitter.streamChunk(
              workflowId,
              runId,
              nodeId,
              chunk,
              partialResponse,
            );
          } else if (partialResponse !== undefined) {
            executionEmitter.nodeStreaming(
              workflowId,
              runId,
              nodeId,
              partialResponse,
            );
          }
          break;
        case "SUCCESS":
          executionEmitter.nodeCompleted(
            workflowId,
            runId,
            nodeId,
            "unknown",
            output ?? {},
            durationMs ?? 0,
          );
          break;
        case "FAILED":
          executionEmitter.nodeFailed(
            workflowId,
            runId,
            nodeId,
            "unknown",
            error ?? "Unknown error",
            durationMs ?? 0,
          );
          break;
        case "SKIPPED":
          executionEmitter.nodeSkipped(workflowId, runId, nodeId);
          break;
      }
    }

    // ─── Persist to DB (skip streaming events — too frequent) ────────────────
    if (status === "STREAMING") {
      return NextResponse.json({ ok: true });
    }

    const existing = await db.nodeRun.findFirst({
      where: { runId, nodeId },
      select: { id: true },
    });

    if (existing) {
      await db.nodeRun.update({
        where: { id: existing.id },
        data: {
          status: statusMap[status],
          ...(output && { output: output as Prisma.InputJsonValue }),
          ...(error && { error }),
          ...(durationMs !== undefined && { duration: durationMs }),
          ...(["SUCCESS", "FAILED", "SKIPPED"].includes(status) && {
            finishedAt: new Date(),
          }),
        },
      });
    } else {
      const run = await db.run.findUnique({
        where: { id: runId },
        include: { workflow: { select: { nodes: true } } },
      });

      const nodes =
        (run?.workflow?.nodes as { id: string; type: string }[]) ?? [];
      const nodeType = nodes.find((n) => n.id === nodeId)?.type ?? "unknown";

      await db.nodeRun.create({
        data: {
          runId,
          nodeId,
          nodeType,
          status: statusMap[status],
          input: (input ?? {}) as Prisma.InputJsonValue,
          output: output ? (output as Prisma.InputJsonValue) : undefined,
          error:
            status === "SKIPPED" ? "Skipped due to upstream failure" : error,
          duration: durationMs,
          finishedAt: ["SUCCESS", "FAILED", "SKIPPED"].includes(status)
            ? new Date()
            : undefined,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
