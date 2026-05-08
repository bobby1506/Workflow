import { db } from "@/lib/db";
import type { Workflow } from "@/generated/prisma/client";
import type { UpdateWorkflowData } from "@/lib/types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function upsertUser(clerkId: string): Promise<string> {
  const user = await db.user.upsert({
    where: { clerkId },
    create: { clerkId },
    update: {},
    select: { id: true },
  });
  return user.id;
}

const DEFAULT_NODES = [
  {
    id: "request-inputs",
    type: "request-inputs",
    position: { x: 100, y: 200 },
    data: { fields: [] },
    deletable: false,
  },
  {
    id: "response",
    type: "response",
    position: { x: 900, y: 200 },
    data: {},
    deletable: false,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new blank workflow for the given Clerk user.
 */
export async function createWorkflow(
  clerkId: string,
  name: string,
): Promise<Workflow> {
  const userId = await upsertUser(clerkId);

  return db.workflow.create({
    data: {
      userId,
      name,
      nodes: DEFAULT_NODES,
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  });
}

/**
 * Fetch all workflows for the user, with optional name search.
 */
export async function getUserWorkflows(
  clerkId: string,
  search?: string,
): Promise<Workflow[]> {
  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) return [];

  return db.workflow.findMany({
    where: {
      userId: user.id,
      isTemplate: false,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Fetch all template workflows (globally readable).
 */
export async function getTemplateWorkflows(): Promise<Workflow[]> {
  return db.workflow.findMany({
    where: { isTemplate: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Update a workflow. Scoped to owner — templates cannot be updated.
 */
export async function updateWorkflow(
  id: string,
  clerkId: string,
  data: UpdateWorkflowData,
): Promise<Workflow> {
  const user = await db.user.findUniqueOrThrow({
    where: { clerkId },
    select: { id: true },
  });

  const existing = await db.workflow.findFirstOrThrow({
    where: { id, userId: user.id },
    select: { id: true, isReadonly: true },
  });

  if (existing.isReadonly) {
    throw new Error("Cannot edit a readonly workflow");
  }

  return db.workflow.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nodes !== undefined && { nodes: data.nodes as object[] }),
      ...(data.edges !== undefined && { edges: data.edges as object[] }),
      ...(data.viewport !== undefined && { viewport: data.viewport as object }),
    },
  });
}

/**
 * Delete a workflow. Templates cannot be deleted.
 */
export async function deleteWorkflow(
  id: string,
  clerkId: string,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({
    where: { clerkId },
    select: { id: true },
  });

  const existing = await db.workflow.findFirstOrThrow({
    where: { id, userId: user.id },
    select: { id: true, isTemplate: true },
  });

  if (existing.isTemplate) {
    throw new Error("Cannot delete a template workflow");
  }

  await db.workflow.delete({ where: { id } });
}

/**
 * Fetch a single workflow by ID, scoped to the authenticated user.
 * Also allows reading templates (globally readable).
 */
export async function getWorkflowById(
  id: string,
  clerkId: string,
): Promise<Workflow | null> {
  // Check if it's a template (globally readable)
  const template = await db.workflow.findFirst({
    where: { id, isTemplate: true },
  });
  if (template) return template;

  // Otherwise scope to user
  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) return null;

  return db.workflow.findFirst({
    where: { id, userId: user.id },
  });
}

/**
 * Clone a template (or any workflow) into a new workflow owned by the user.
 * This is the primary way users interact with templates.
 */
export async function cloneWorkflow(
  sourceId: string,
  clerkId: string,
): Promise<Workflow> {
  const userId = await upsertUser(clerkId);

  const source = await db.workflow.findUniqueOrThrow({
    where: { id: sourceId },
    select: {
      name: true,
      nodes: true,
      edges: true,
      viewport: true,
      isTemplate: true,
    },
  });

  const cloneName = source.isTemplate
    ? `${source.name} (Copy)`
    : `Copy of ${source.name}`;

  return db.workflow.create({
    data: {
      userId,
      name: cloneName,
      nodes: source.nodes as object[],
      edges: source.edges as object[],
      viewport: source.viewport as object,
      isTemplate: false,
      isReadonly: false,
      templateSourceId: sourceId,
    },
  });
}
