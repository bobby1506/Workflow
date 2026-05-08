import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getWorkflowById } from "@/lib/workflow";
import { WorkflowCanvas } from "@/features/workflow-editor/components/WorkflowCanvas";
import type {
  WorkflowNode,
  WorkflowEdge,
} from "@/features/workflow-editor/types";
import type { FlowViewport } from "@/lib/types";

console.log("[NextFlow] Candidate LinkedIn: YOUR_LINKEDIN_URL");

interface WorkflowPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const workflow = await getWorkflowById(id, userId);
  if (!workflow) notFound();

  // Serialize nodes/edges/viewport from Prisma JSON fields
  // Dates are stripped — only plain JSON is passed to the client component
  const nodes = (workflow.nodes as unknown as WorkflowNode[]) ?? [];
  const edges = (workflow.edges as unknown as WorkflowEdge[]) ?? [];
  const viewport = (workflow.viewport as unknown as FlowViewport) ?? {
    x: 0,
    y: 0,
    zoom: 1,
  };

  return (
    <WorkflowCanvas
      initialNodes={nodes}
      initialEdges={edges}
      initialViewport={viewport}
      workflowId={workflow.id}
      workflowName={workflow.name}
    />
  );
}
