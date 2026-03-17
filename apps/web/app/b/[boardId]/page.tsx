export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBoardMembers, listShareLinks, resolveBoardAccess } from "@whiteboard/db";
import { signRoomToken } from "@whiteboard/shared";
import { SharePanel } from "../../../components/share-panel";
import { getServerSession } from "../../../lib/session";
import { BoardEditor } from "./_components/board-editor";

export default async function BoardPage({ params, searchParams }: { params: Promise<{ boardId: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const shareToken = typeof resolvedSearchParams.share === "string" ? resolvedSearchParams.share : null;
  const session = await getServerSession();
  const { board, access } = await resolveBoardAccess({
    boardId: resolvedParams.boardId,
    userId: session?.user?.id ?? null,
    shareToken,
  });

  if (!board || !access?.canView || !access.role) {
    notFound();
  }

  const roomToken = await signRoomToken(
    {
      boardId: board.id,
      userId: session?.user?.id ?? null,
      role: access.role,
      name: session?.user?.name ?? `Guest ${shareToken?.slice(0, 6) ?? "viewer"}`,
    },
    process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
  );

  const members = access.canManageSharing ? await listBoardMembers(board.id) : [];
  const links = access.canManageSharing
    ? (await listShareLinks(board.id)).map((link) => ({
        ...link,
        url: `${process.env.APP_URL ?? "http://localhost:3000"}/b/${board.id}`,
      }))
    : [];

  return (
    <main className="board-page">
      <header className="board-header">
        <div>
          <Link href="/boards" className="back-link">Back to boards</Link>
          <h1>{board.name}</h1>
          <p className="muted">Role: {access.role}</p>
        </div>
      </header>

      <BoardEditor boardId={board.id} roomToken={roomToken} role={access.role} userName={session?.user?.name ?? "Guest user"} />
      {access.canManageSharing ? <SharePanel boardId={board.id} initialMembers={members} initialLinks={links} /> : null}
    </main>
  );
}

