import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { RunStatus } from "@/generated/prisma/client";
import { executionEmitter } from "@/lib/realtime/emitters/executionEmitter";

const runCompleteSchema = z.object({
  runId: z.string(),
  workflowId: z.string().optional(),
  status: z.enum(["SUCCESS", "FAILED", "PARTIAL"]),
});

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = runCompleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { runId, status } = parsed.data;

  const statusMap: Record<string, RunStatus> = {
    SUCCESS: RunStatus.SUCCESS,
    FAILED: RunStatus.FAILED,
    PARTIAL: RunStatus.PARTIAL,
  };

  try {
    const run = await db.run.findUnique({
      where: { id: runId },
      select: { startedAt: true, workflowId: true },
    });

    const finishedAt = new Date();
    const duration = run ? finishedAt.getTime() - run.startedAt.getTime() : 0;

    await db.run.update({
      where: { id: runId },
      data: { status: statusMap[status], finishedAt, duration },
    });

    // Emit SSE event
    const workflowId = parsed.data.workflowId ?? run?.workflowId;
    if (workflowId) {
      if (status === "FAILED") {
        executionEmitter.workflowFailed(
          workflowId,
          runId,
          "Workflow failed",
          duration,
        );
      } else {
        executionEmitter.workflowCompleted(
          workflowId,
          runId,
          status === "SUCCESS" ? "success" : "partial",
          duration,
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
