export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { deleteBoard, renameBoard, resolveBoardAccess } from "@whiteboard/db";
import { getServerSession } from "../../../../lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ boardId: string }> }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await context.params;
  const body = await request.json().catch(() => ({}));
  await renameBoard({ boardId, ownerId: session.user.id, name: typeof body.name === "string" ? body.name : "Untitled board" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ boardId: string }> }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { boardId } = await context.params;
  const { access } = await resolveBoardAccess({ boardId, userId: session.user.id });
  if (!access?.canManageSharing) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await deleteBoard({ boardId, ownerId: session.user.id });
  return NextResponse.json({ ok: true });
}

