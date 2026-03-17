"use client";

import { inlineBase64AssetStore, Tldraw } from "@tldraw/tldraw";
import { useSync } from "@tldraw/sync";
import { useMemo } from "react";
import type { BoardRole } from "@whiteboard/shared";
import { stringToColor } from "../../../../lib/utils";

export function BoardEditor({ boardId, roomToken, role, userName }: { boardId: string; roomToken: string; role: BoardRole; userName: string }) {
  const userInfo = useMemo(
    () => ({
      id: `${boardId}-${userName}`,
      name: userName,
      color: stringToColor(userName),
    }),
    [boardId, userName],
  );

  const store = useSync({
    uri: `${process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001"}/room/${boardId}?token=${encodeURIComponent(roomToken)}`,
    assets: inlineBase64AssetStore,
    userInfo,
  });

  return (
    <div className="editor-shell">
      {role === "viewer" ? <div className="board-banner">View only mode. Use an edit link or ask the owner for edit access.</div> : null}
      <div className="editor-canvas">
        <Tldraw store={store} autoFocus />
      </div>
    </div>
  );
}
