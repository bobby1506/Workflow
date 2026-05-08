import { db } from "@/lib/db";
import {
  TEMPLATE_WORKFLOW_NAME,
  TEMPLATE_NODES,
  TEMPLATE_EDGES,
  TEMPLATE_VIEWPORT,
} from "@/lib/templateData";

/**
 * Ensures the demo template workflow exists in the database.
 * Safe to call on every startup — idempotent.
 * Uses a dedicated system user (clerkId = "system") to own templates.
 */
export async function ensureTemplateExists(): Promise<void> {
  // Check if template already exists
  const existing = await db.workflow.findFirst({
    where: { isTemplate: true, name: TEMPLATE_WORKFLOW_NAME },
    select: { id: true },
  });

  if (existing) return;

  // Upsert the system user that owns all templates
  const systemUser = await db.user.upsert({
    where: { clerkId: "system" },
    create: { clerkId: "system", email: "system@nextflow.internal" },
    update: {},
    select: { id: true },
  });

  await db.workflow.create({
    data: {
      userId: systemUser.id,
      name: TEMPLATE_WORKFLOW_NAME,
      nodes: TEMPLATE_NODES,
      edges: TEMPLATE_EDGES,
      viewport: TEMPLATE_VIEWPORT,
      isTemplate: true,
      isReadonly: true,
    },
  });
}
