import { NextResponse } from "next/server";
import { getSessionUser, publicProfile } from "@/lib/auth-server";
import { loadWorkspace } from "@/lib/workspace-db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ signedIn: false }, { status: 401 });
  }
  return NextResponse.json({
    signedIn: true,
    profile: publicProfile(user),
    workspace: await loadWorkspace(user.id),
  });
}
