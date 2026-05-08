import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { RunStatus } from "@/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/workflows/[id]/runs — fetch all runs for a workflow
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workflowId } = await params;

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return NextResponse.json([]);

    // Auto-expire stale RUNNING runs older than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await db.run.updateMany({
      where: {
        workflowId,
        userId: user.id,
        status: RunStatus.RUNNING,
        startedAt: { lt: tenMinutesAgo },
      },
      data: {
        status: RunStatus.FAILED,
        finishedAt: new Date(),
      },
    });

    const runs = await db.run.findMany({
      where: { workflowId, userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        nodeRuns: { orderBy: { startedAt: "asc" } },
      },
    });

    return NextResponse.json(runs);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
