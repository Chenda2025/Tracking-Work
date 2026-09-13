import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { loadWorkspace, saveWorkspace, type WorkspacePayload } from "@/lib/workspace-db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await loadWorkspace(user.id));
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = (await request.json()) as WorkspacePayload;
    await saveWorkspace(user.id, data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
