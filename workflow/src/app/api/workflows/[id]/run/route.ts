import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { RunStatus, RunScope } from "@/generated/prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import type { WorkflowTaskPayload } from "@/trigger/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const runRequestSchema = z.object({
  scope: z.enum(["FULL", "PARTIAL", "SINGLE_NODE"]).default("FULL"),
  targetNodeIds: z.array(z.string()).optional(),
  /** Serialized workflow graph — sent from the client */
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workflowId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = runRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const user = await db.user.findUniqueOrThrow({
      where: { clerkId: userId },
      select: { id: true },
    });

    // Verify ownership and fetch workflow graph
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: workflowId, userId: user.id },
      select: { id: true, nodes: true, edges: true },
    });

    const scopeMap: Record<string, RunScope> = {
      FULL: RunScope.FULL,
      PARTIAL: RunScope.PARTIAL,
      SINGLE_NODE: RunScope.SINGLE_NODE,
    };

    // Create DB Run record
    const [run] = await db.$transaction([
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

    // Determine base URL for internal callbacks
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const callbackBaseUrl = `${protocol}://${host}`;

    // Use nodes/edges from request body if provided (latest canvas state),
    // otherwise fall back to DB-persisted graph
    const nodes = (parsed.data.nodes ?? workflow.nodes) as unknown[];
    const edges = (parsed.data.edges ?? workflow.edges) as unknown[];

    // Dispatch the workflow orchestrator as a Trigger.dev task
    const triggerPayload: WorkflowTaskPayload = {
      runId: run.id,
      workflowId,
      nodes,
      edges,
      scope: parsed.data.scope,
      targetNodeIds: parsed.data.targetNodeIds,
      callbackBaseUrl,
    };

    // Check if Trigger.dev is configured
    const hasTriggerConfig =
      process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_ID;

    // In local dev (localhost), the Trigger.dev cloud cannot reach our callback URLs.
    // So we only use distributed mode when deployed (non-localhost).
    const isLocalhost =
      host.includes("localhost") || host.includes("127.0.0.1");
    const useDistributed = !!hasTriggerConfig && !isLocalhost;

    if (useDistributed) {
      // Production: dispatch to Trigger.dev — non-blocking, returns immediately
      await tasks.trigger("workflow-orchestrate", triggerPayload);
    }
    // In dev/localhost: frontend will orchestrate via mock executors
    // (distributed=false tells the client to use frontend orchestration)

    return NextResponse.json(
      {
        runId: run.id,
        distributed: useDistributed,
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
