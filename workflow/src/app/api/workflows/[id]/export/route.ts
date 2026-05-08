import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { buildWorkflowExport } from "@/lib/workflow-io/exporter";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const workflow = await db.workflow.findFirst({
      where: { id, userId: user.id },
    });
    if (!workflow)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const exportData = buildWorkflowExport({
      name: workflow.name,
      nodes: workflow.nodes,
      edges: workflow.edges,
      viewport: workflow.viewport,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });

    return NextResponse.json(exportData);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
