export const dynamic = "force-dynamic";
import { listBoardsForUser } from "@whiteboard/db";
import { BoardsDashboard } from "../../components/boards-dashboard";
import { requireSession } from "../../lib/session";

export default async function BoardsPage() {
  const session = await requireSession();
  const boards = await listBoardsForUser(session.user.id);

  return <BoardsDashboard initialBoards={boards} userName={session.user.name} />;
}

