import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth as triggerAuth } from "@trigger.dev/sdk/v3";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const tokenRequestSchema = z.object({
  runId: z.string().min(1, "runId is required"),
});

/**
 * POST /api/workflows/[id]/token
 *
 * Generates a scoped Trigger.dev public token for a specific run.
 * The token is short-lived (max 1 hour) and scoped to the run ID.
 *
 * Request body:
 * - runId: string (DB Run ID)
 *
 * Response:
 * - publicToken: string (scoped Trigger.dev token)
 *
 * Errors:
 * - 401: User not authenticated
 * - 400: Invalid request body
 * - 403: User does not own the run
 * - 404: Run not found
 * - 500: Token generation failed
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workflowId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = tokenRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request: runId is required" },
        { status: 400 },
      );
    }

    const { runId } = parsed.data;

    // Get the current user
    const user = await db.user.findUniqueOrThrow({
      where: { clerkId: userId },
      select: { id: true },
    });

    // Verify the run exists and belongs to the user
    const run = await db.run.findFirst({
      where: {
        id: runId,
        userId: user.id,
        workflow: { id: workflowId },
      },
      select: { id: true, triggerRunId: true },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Run not found or access denied" },
        { status: 403 },
      );
    }

    // If we don't have a triggerRunId, we can't generate a token
    if (!run.triggerRunId) {
      return NextResponse.json(
        { error: "Run does not have a Trigger.dev run ID" },
        { status: 400 },
      );
    }

    // Generate a scoped public token using Trigger.dev SDK
    // Token is scoped to read-only access to this specific run
    // Expiry is set to 1 hour (3600 seconds)
    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          runs: [run.triggerRunId],
        },
      },
      expirationTime: "1h",
    });

    return NextResponse.json({ publicToken }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Token generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
