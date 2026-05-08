import { db } from "@/lib/db";
import { NodeRunStatus } from "@/generated/prisma/client";
import type { NodeRun, Prisma } from "@/generated/prisma/client";

/**
 * Create a NodeRun row when a node begins execution.
 * Every node execution MUST call this — no exceptions.
 */
export async function createNodeRun(
  runId: string,
  nodeId: string,
  nodeType: string,
  input: Record<string, unknown>,
): Promise<NodeRun> {
  return db.nodeRun.create({
    data: {
      runId,
      nodeId,
      nodeType,
      status: NodeRunStatus.PENDING,
      input: input as Prisma.InputJsonValue,
    },
  });
}

/**
 * Mark a node run as successfully completed.
 * Calculates duration from startedAt automatically.
 */
export async function updateNodeRunSuccess(
  id: string,
  output: Record<string, unknown>,
): Promise<NodeRun> {
  const nodeRun = await db.nodeRun.findUniqueOrThrow({
    where: { id },
    select: { startedAt: true },
  });

  const finishedAt = new Date();
  const duration = finishedAt.getTime() - nodeRun.startedAt.getTime();

  return db.nodeRun.update({
    where: { id },
    data: {
      status: NodeRunStatus.SUCCESS,
      output: output as Prisma.InputJsonValue,
      finishedAt,
      duration,
    },
  });
}

/**
 * Mark a node run as failed with an error message.
 * Calculates duration from startedAt automatically.
 */
export async function updateNodeRunFailure(
  id: string,
  error: string,
): Promise<NodeRun> {
  const nodeRun = await db.nodeRun.findUniqueOrThrow({
    where: { id },
    select: { startedAt: true },
  });

  const finishedAt = new Date();
  const duration = finishedAt.getTime() - nodeRun.startedAt.getTime();

  return db.nodeRun.update({
    where: { id },
    data: {
      status: NodeRunStatus.FAILED,
      error,
      finishedAt,
      duration,
    },
  });
}

/**
 * Update just the status of a node run.
 * Use this to transition PENDING → RUNNING before execution starts.
 */
export async function updateNodeRunStatus(
  id: string,
  status: NodeRunStatus,
): Promise<NodeRun> {
  return db.nodeRun.update({
    where: { id },
    data: { status },
  });
}
