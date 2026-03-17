export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { addBoardMemberByEmail, resolveBoardAccess } from "@whiteboard/db";
import { getServerSession } from "../../../../../lib/session";

export async function POST(request: Request, context: { params: Promise<{ boardId: string }> }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await context.params;
  const { access } = await resolveBoardAccess({ boardId, userId: session.user.id });
  if (!access?.canManageSharing) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    await addBoardMemberByEmail({
      boardId,
      ownerId: session.user.id,
      email: typeof body.email === "string" ? body.email : "",
      role: body.role === "editor" ? "editor" : "viewer",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to add member" }, { status: 400 });
  }
}

