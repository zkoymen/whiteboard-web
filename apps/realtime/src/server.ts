import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { TLSocketRoom } from "@tldraw/sync-core";
import { ensureDatabase, getBoardSnapshot, saveBoardSnapshot } from "@whiteboard/db";
import { verifyRoomToken } from "@whiteboard/shared";

type SessionMeta = {
  userId: string | null;
  name: string;
  role: "owner" | "editor" | "viewer";
};

const port = Number(process.env.REALTIME_PORT ?? 4001);
const secret = process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me";
const rooms = new Map<string, Promise<TLSocketRoom<any, SessionMeta>>>();
const saveTimers = new Map<string, NodeJS.Timeout>();

async function createRoom(boardId: string) {
  const initialSnapshot = await getBoardSnapshot(boardId);
  const room = new TLSocketRoom<any, SessionMeta>({
    initialSnapshot: initialSnapshot ?? undefined,
    onDataChange() {
      const existingTimer = saveTimers.get(boardId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      saveTimers.set(
        boardId,
        setTimeout(async () => {
          await saveBoardSnapshot(boardId, room.getCurrentSnapshot());
        }, 250),
      );
    },
    onSessionRemoved(currentRoom) {
      if (currentRoom.getNumActiveSessions() === 0) {
        setTimeout(() => {
          if (currentRoom.getNumActiveSessions() === 0) {
            rooms.delete(boardId);
          }
        }, 30000);
      }
    },
  });

  return room;
}

async function getRoom(boardId: string) {
  if (!rooms.has(boardId)) {
    rooms.set(boardId, createRoom(boardId));
  }
  return rooms.get(boardId)!;
}

await ensureDatabase();

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404);
  response.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (!url.pathname.startsWith("/room/")) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, async (ws) => {
    try {
      const boardId = url.pathname.replace("/room/", "");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(4001, "missing-token");
        return;
      }

      const claims = await verifyRoomToken(token, secret);
      if (claims.boardId !== boardId) {
        ws.close(4003, "board-mismatch");
        return;
      }

      const room = await getRoom(boardId);
      room.handleSocketConnect({
        sessionId: url.searchParams.get("sessionId") ?? randomUUID(),
        socket: ws as any,
        isReadonly: claims.role === "viewer",
        meta: {
          userId: claims.userId,
          name: claims.name,
          role: claims.role,
        },
      });
    } catch (error) {
      ws.close(4003, error instanceof Error ? error.message : "invalid-token");
    }
  });
});

server.listen(port, () => {
  console.log(`[realtime] listening on ${port}`);
});
