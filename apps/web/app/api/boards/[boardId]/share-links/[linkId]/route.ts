export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveBoardAccess, revokeShareLink } from "@whiteboard/db";
import { getServerSession } from "../../../../../../lib/session";

export async function DELETE(_: Request, context: { params: Promise<{ boardId: string; linkId: string }> }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { boardId, linkId } = await context.params;
  const { access } = await resolveBoardAccess({ boardId, userId: session.user.id });
  if (!access?.canManageSharing) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await revokeShareLink({ boardId, ownerId: session.user.id, linkId });
  return NextResponse.json({ ok: true });
}

