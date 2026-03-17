export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { removeBoardMember, resolveBoardAccess, updateBoardMemberRole } from "@whiteboard/db";
import { getServerSession } from "../../../../../../lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ boardId: string; userId: string }> }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { boardId, userId } = await context.params;
  const { access } = await resolveBoardAccess({ boardId, userId: session.user.id });
  if (!access?.canManageSharing) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  await updateBoardMemberRole({ boardId, ownerId: session.user.id, userId, role: body.role === "editor" ? "editor" : "viewer" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ boardId: string; userId: string }> }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { boardId, userId } = await context.params;
  const { access } = await resolveBoardAccess({ boardId, userId: session.user.id });
  if (!access?.canManageSharing) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await removeBoardMember({ boardId, ownerId: session.user.id, userId });
  return NextResponse.json({ ok: true });
}

