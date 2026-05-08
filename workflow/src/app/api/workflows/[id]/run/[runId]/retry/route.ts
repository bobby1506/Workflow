import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { RunStatus, RunScope } from "@/generated/prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import type { WorkflowTaskPayload } from "@/trigger/types";

interface RouteContext {
  params: Promise<{ id: string; runId: string }>;
}

const retrySchema = z.object({
  scope: z.enum(["FULL", "PARTIAL", "SINGLE_NODE"]).default("FULL"),
  targetNodeIds: z.array(z.string()).optional(),
});

/**
 * POST /api/workflows/[id]/run/[runId]/retry
 * Creates a new Run that retries the given run's workflow.
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workflowId, runId: _originalRunId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = retrySchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const user = await db.user.findUniqueOrThrow({
      where: { clerkId: userId },
      select: { id: true },
    });

    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: workflowId, userId: user.id },
      select: { id: true, nodes: true, edges: true },
    });

    const scopeMap: Record<string, RunScope> = {
      FULL: RunScope.FULL,
      PARTIAL: RunScope.PARTIAL,
      SINGLE_NODE: RunScope.SINGLE_NODE,
    };

    const [newRun] = await db.$transaction([
      db.run.create({
        data: {
          workflowId,
          userId: user.id,
          status: RunStatus.RUNNING,
          scope: scopeMap[parsed.data.scope],
        },
      }),
      db.workflow.update({
        where: { id: workflowId },
        data: { lastRunAt: new Date() },
      }),
    ]);

    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const callbackBaseUrl = `${protocol}://${host}`;

    const hasTrigger =
      process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_ID;

    if (hasTrigger) {
      const triggerPayload: WorkflowTaskPayload = {
        runId: newRun.id,
        workflowId,
        nodes: workflow.nodes as unknown[],
        edges: workflow.edges as unknown[],
        scope: parsed.data.scope,
        targetNodeIds: parsed.data.targetNodeIds,
        callbackBaseUrl,
      };
      await tasks.trigger("workflow-orchestrate", triggerPayload);
    }

    return NextResponse.json(
      { runId: newRun.id, distributed: !!hasTrigger },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
