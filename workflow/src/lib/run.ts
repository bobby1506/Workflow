import { db } from "@/lib/db";
import { RunStatus, RunScope } from "@/generated/prisma/client";
import type { Run } from "@/generated/prisma/client";

/**
 * Create a new Run for a workflow execution.
 * Stamps the workflow's lastRunAt immediately.
 */
export async function createRun(
  workflowId: string,
  clerkId: string,
  scope: RunScope = RunScope.FULL,
): Promise<Run> {
  const user = await db.user.findUniqueOrThrow({
    where: { clerkId },
    select: { id: true },
  });

  // Verify the workflow belongs to this user
  await db.workflow.findFirstOrThrow({
    where: { id: workflowId, userId: user.id },
    select: { id: true },
  });

  const [run] = await db.$transaction([
    db.run.create({
      data: {
        workflowId,
        userId: user.id,
        status: RunStatus.RUNNING,
        scope,
      },
    }),
    db.workflow.update({
      where: { id: workflowId },
      data: { lastRunAt: new Date() },
    }),
  ]);

  return run;
}

/**
 * Update the status of a run (e.g. mid-execution status changes).
 */
export async function updateRunStatus(
  runId: string,
  status: RunStatus,
): Promise<Run> {
  return db.run.update({
    where: { id: runId },
    data: { status },
  });
}

/**
 * Mark a run as finished.
 * Calculates duration from startedAt automatically.
 * Defaults to SUCCESS if no status is provided.
 */
export async function finishRun(
  runId: string,
  status: RunStatus = RunStatus.SUCCESS,
): Promise<Run> {
  const run = await db.run.findUniqueOrThrow({
    where: { id: runId },
    select: { startedAt: true },
  });

  const finishedAt = new Date();
  const duration = finishedAt.getTime() - run.startedAt.getTime();

  return db.run.update({
    where: { id: runId },
    data: {
      status,
      finishedAt,
      duration,
    },
  });
}

/**
 * Fetch a single run with all its nodeRuns.
 * Useful for rendering execution results.
 */
export async function getRunWithNodeRuns(runId: string) {
  return db.run.findUniqueOrThrow({
    where: { id: runId },
    include: {
      nodeRuns: {
        orderBy: { startedAt: "asc" },
      },
    },
  });
}
