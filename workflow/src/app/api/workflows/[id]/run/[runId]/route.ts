import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { RunStatus, NodeRunStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string; runId: string }>;
}

// PATCH /api/workflows/[id]/run/[runId] — update run status
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;
    const body = await request.json().catch(() => ({}));

    const schema = z.object({
      status: z.enum(["RUNNING", "SUCCESS", "FAILED", "PARTIAL"]),
      finishedAt: z.string().optional(),
      duration: z.number().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const statusMap: Record<string, RunStatus> = {
      RUNNING: RunStatus.RUNNING,
      SUCCESS: RunStatus.SUCCESS,
      FAILED: RunStatus.FAILED,
      PARTIAL: RunStatus.PARTIAL,
    };

    const run = await db.run.update({
      where: { id: runId },
      data: {
        status: statusMap[parsed.data.status],
        ...(parsed.data.finishedAt && {
          finishedAt: new Date(parsed.data.finishedAt),
        }),
        ...(parsed.data.duration !== undefined && {
          duration: parsed.data.duration,
        }),
      },
    });

    return NextResponse.json(run);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/workflows/[id]/run/[runId] — fetch run with nodeRuns
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;

    const run = await db.run.findUniqueOrThrow({
      where: { id: runId },
      include: {
        nodeRuns: { orderBy: { startedAt: "asc" } },
      },
    });

    return NextResponse.json(run);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
