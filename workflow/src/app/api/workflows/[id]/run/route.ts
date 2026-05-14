import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { RunStatus, RunScope } from "@/generated/prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { auth as triggerAuth } from "@trigger.dev/sdk/v3";
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

/**
 * Helper function to generate a scoped Trigger.dev public token
 */
async function generatePublicToken(triggerRunId: string): Promise<string> {
  const publicToken = await triggerAuth.createPublicToken({
    scopes: {
      read: {
        runs: [triggerRunId],
      },
    },
    expirationTime: "1h",
  });
  return publicToken;
}

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
    };

    // Check if Trigger.dev is configured
    const hasTriggerConfig =
      process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_PROJECT_ID;

    // In local dev (localhost), the Trigger.dev cloud cannot reach our callback URLs.
    // So we only use distributed mode when deployed (non-localhost).
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "localhost:3000";
    const isLocalhost =
      host.includes("localhost") || host.includes("127.0.0.1");
    const useDistributed = !!hasTriggerConfig && !isLocalhost;

    let triggerRunId: string | null = null;
    let publicToken: string | null = null;

    if (useDistributed) {
      // Production: dispatch to Trigger.dev — non-blocking, returns immediately
      const handle = await tasks.trigger(
        "workflow-orchestrate",
        triggerPayload,
      );
      triggerRunId = handle.id;

      // Store the Trigger.dev run ID in the database
      await db.run.update({
        where: { id: run.id },
        data: { triggerRunId },
      });

      // Generate a scoped public token for the frontend
      try {
        publicToken = await generatePublicToken(triggerRunId);
      } catch (err) {
        console.error("Error generating public token:", err);
        // Token generation failure is not fatal — frontend can retry
      }
    }
    // In dev/localhost: frontend will orchestrate via mock executors
    // (distributed=false tells the client to use frontend orchestration)

    return NextResponse.json(
      {
        runId: run.id,
        distributed: useDistributed,
        triggerRunId,
        publicToken,
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
