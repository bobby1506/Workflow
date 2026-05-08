import { auth } from "@clerk/nextjs/server";
import { getUserWorkflows, getTemplateWorkflows } from "@/lib/workflow";
import { ensureTemplateExists } from "@/lib/seedTemplate";
import { WorkflowDashboard } from "@/components/dashboard/WorkflowDashboard";

console.log("[NextFlow] Candidate LinkedIn: YOUR_LINKEDIN_URL");

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  await ensureTemplateExists();

  const [workflows, templates] = await Promise.all([
    getUserWorkflows(userId),
    getTemplateWorkflows(),
  ]);

  const serializedWorkflows = workflows.map((w) => ({
    id: w.id,
    name: w.name,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    lastRunAt: w.lastRunAt?.toISOString() ?? null,
    isTemplate: w.isTemplate,
    isReadonly: w.isReadonly,
    templateSourceId: w.templateSourceId,
  }));

  const serializedTemplates = templates.map((t) => ({
    id: t.id,
    name: t.name,
    updatedAt: t.updatedAt.toISOString(),
    isTemplate: t.isTemplate,
    isReadonly: t.isReadonly,
  }));

  return (
    <div className="min-h-screen bg-white">
      <WorkflowDashboard
        initialWorkflows={serializedWorkflows}
        templates={serializedTemplates}
      />
    </div>
  );
}
