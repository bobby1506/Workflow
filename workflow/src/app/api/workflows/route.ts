import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createWorkflow, getUserWorkflows } from "@/lib/workflow";
import { createWorkflowSchema } from "@/lib/validations/workflow";
import { ensureTemplateExists } from "@/lib/seedTemplate";
import { db } from "@/lib/db";
import { RunStatus } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || undefined;

    const workflows = await getUserWorkflows(userId, search);

    // Check which workflows have an active RUNNING run
    const workflowIds = workflows.map((w) => w.id);
    const runningRuns =
      workflowIds.length > 0
        ? await db.run.findMany({
            where: {
              workflowId: { in: workflowIds },
              status: RunStatus.RUNNING,
              // Only consider runs started in the last 10 minutes (stale guard)
              startedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
            },
            select: { workflowId: true },
          })
        : [];

    const runningWorkflowIds = new Set(runningRuns.map((r) => r.workflowId));

    return NextResponse.json(
      workflows.map((w) => ({
        id: w.id,
        name: w.name,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        lastRunAt: w.lastRunAt,
        isTemplate: w.isTemplate,
        isReadonly: w.isReadonly,
        templateSourceId: w.templateSourceId,
        hasRunning: runningWorkflowIds.has(w.id),
      })),
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure template exists on first workflow creation
    await ensureTemplateExists();

    const body = await request.json().catch(() => ({}));
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const name = parsed.data.name ?? "Untitled Workflow";
    const workflow = await createWorkflow(userId, name);

    return NextResponse.json(workflow, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
