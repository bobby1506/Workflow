import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  validateWorkflowImport,
  remapWorkflowIds,
} from "@/lib/workflow-io/importer";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const validation = validateWorkflowImport(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: "Invalid workflow file", details: validation.errors },
        { status: 400 },
      );
    }

    // Remap IDs to avoid conflicts
    const remapped = remapWorkflowIds(validation.data);

    // Upsert user
    const user = await db.user.upsert({
      where: { clerkId: userId },
      create: { clerkId: userId },
      update: {},
      select: { id: true },
    });

    const workflow = await db.workflow.create({
      data: {
        userId: user.id,
        name: `${remapped.metadata.name} (Imported)`,
        nodes: remapped.graph.nodes as Prisma.InputJsonValue,
        edges: remapped.graph.edges as Prisma.InputJsonValue,
        viewport: remapped.graph.viewport as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      { id: workflow.id, name: workflow.name },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
