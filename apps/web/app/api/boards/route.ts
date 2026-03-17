export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createBoard } from "@whiteboard/db";
import { getServerSession } from "../../../lib/session";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const boardId = await createBoard({
    ownerId: session.user.id,
    name: typeof body.name === "string" ? body.name : undefined,
  });

  return NextResponse.json({ boardId });
}

