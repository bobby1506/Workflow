import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTemplateWorkflows } from "@/lib/workflow";
import { ensureTemplateExists } from "@/lib/seedTemplate";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTemplateExists();
    const templates = await getTemplateWorkflows();

    return NextResponse.json(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        updatedAt: t.updatedAt,
        isTemplate: t.isTemplate,
        isReadonly: t.isReadonly,
      })),
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
