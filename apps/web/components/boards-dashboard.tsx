"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Input } from "@whiteboard/ui";
import type { BoardSummary } from "@whiteboard/shared";

async function request(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed");
  }
  return payload;
}

export function BoardsDashboard({ initialBoards, userName }: { initialBoards: BoardSummary[]; userName: string }) {
  const router = useRouter();
  const [boardName, setBoardName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createBoard() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = await request("/api/boards", {
          method: "POST",
          body: JSON.stringify({ name: boardName }),
        });
        router.push(`/b/${payload.boardId}`);
        router.refresh();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Failed to create board");
      }
    });
  }

  function deleteBoard(boardId: string) {
    startTransition(async () => {
      try {
        await request(`/api/boards/${boardId}`, { method: "DELETE" });
        router.refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete board");
      }
    });
  }

  function renameBoard(boardId: string, name: string) {
    startTransition(async () => {
      try {
        await request(`/api/boards/${boardId}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
        router.refresh();
      } catch (renameError) {
        setError(renameError instanceof Error ? renameError.message : "Failed to rename board");
      }
    });
  }

  return (
    <main className="boards-page">
      <section className="boards-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>{userName.split(" ")[0]}'s boards</h1>
          <p className="muted">Private by default. Share only when needed.</p>
        </div>
      </section>

      <Card className="create-board-card">
        <div>
          <h2>New board</h2>
          <p className="muted">Start with a blank board and invite collaborators after creation.</p>
        </div>
        <div className="create-board-row">
          <Input value={boardName} onChange={(event) => setBoardName(event.target.value)} placeholder="Product review, sprint plan, wireframe..." />
          <Button onClick={createBoard} disabled={isPending}><Plus size={16} />Create</Button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </Card>

      <section className="board-grid">
        {initialBoards.length === 0 ? (
          <Card className="empty-state">
            <h3>No boards yet</h3>
            <p className="muted">Create the first board to start drawing.</p>
          </Card>
        ) : (
          initialBoards.map((board) => (
            <Card key={board.id} className="board-card">
              <button className="board-link" onClick={() => router.push(`/b/${board.id}`)}>
                <span className={`role-pill role-${board.role}`}>{board.role}</span>
                <strong>{board.name}</strong>
                <span className="muted">Updated {new Date(board.updatedAt).toLocaleString()}</span>
              </button>
              <div className="board-card-actions">
                <Input defaultValue={board.name} aria-label={`Rename ${board.name}`} onBlur={(event) => {
                  if (event.target.value !== board.name) {
                    renameBoard(board.id, event.target.value);
                  }
                }} />
                {board.role === "owner" ? <Button className="is-secondary danger" onClick={() => deleteBoard(board.id)}><Trash2 size={16} />Delete</Button> : null}
              </div>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
