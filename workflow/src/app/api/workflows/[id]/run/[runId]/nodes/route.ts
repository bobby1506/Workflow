import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { NodeRunStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string; runId: string }>;
}

const nodeRunSchema = z.object({
  nodeId: z.string(),
  nodeType: z.string(),
  status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED"]),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  duration: z.number().optional(),
  finishedAt: z.string().optional(),
});

// POST — create a NodeRun record
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = nodeRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const statusMap: Record<string, NodeRunStatus> = {
      PENDING: NodeRunStatus.PENDING,
      RUNNING: NodeRunStatus.RUNNING,
      SUCCESS: NodeRunStatus.SUCCESS,
      FAILED: NodeRunStatus.FAILED,
    };

    const nodeRun = await db.nodeRun.create({
      data: {
        runId,
        nodeId: parsed.data.nodeId,
        nodeType: parsed.data.nodeType,
        status: statusMap[parsed.data.status],
        input: (parsed.data.input ?? {}) as Prisma.InputJsonValue,
        output: parsed.data.output
          ? (parsed.data.output as Prisma.InputJsonValue)
          : undefined,
        error: parsed.data.error,
        duration: parsed.data.duration,
        finishedAt: parsed.data.finishedAt
          ? new Date(parsed.data.finishedAt)
          : undefined,
      },
    });

    return NextResponse.json(nodeRun, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
