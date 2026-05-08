import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { RunStatus } from "@/generated/prisma/client";
import { executionEmitter } from "@/lib/realtime/emitters/executionEmitter";

interface RouteContext {
  params: Promise<{ id: string; runId: string }>;
}

/**
 * POST /api/workflows/[id]/run/[runId]/cancel
 * Marks a running run as FAILED (cancelled) and emits SSE event.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workflowId, runId } = await params;

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const run = await db.run.findFirst({
      where: { id: runId, workflowId, userId: user.id },
      select: { id: true, status: true, startedAt: true },
    });

    if (!run)
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    if (run.status !== "RUNNING") {
      return NextResponse.json(
        { error: "Run is not currently running" },
        { status: 400 },
      );
    }

    const finishedAt = new Date();
    const duration = finishedAt.getTime() - run.startedAt.getTime();

    await db.run.update({
      where: { id: runId },
      data: { status: RunStatus.FAILED, finishedAt, duration },
    });

    // Mark all PENDING/RUNNING nodeRuns as failed
    await db.nodeRun.updateMany({
      where: { runId, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", error: "Cancelled by user", finishedAt },
    });

    // Emit SSE cancellation event
    executionEmitter.workflowFailed(
      workflowId,
      runId,
      "Cancelled by user",
      duration,
    );

    return NextResponse.json({ ok: true, runId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
