import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cloneWorkflow } from "@/lib/workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const cloned = await cloneWorkflow(id, userId);

    return NextResponse.json(cloned, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("No") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
