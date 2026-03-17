export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createShareLink, resolveBoardAccess } from "@whiteboard/db";
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
  const payload = await createShareLink({
    boardId,
    ownerId: session.user.id,
    mode: body.mode === "edit" ? "edit" : "view",
  });

  return NextResponse.json(payload);
}

