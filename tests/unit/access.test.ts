import { describe, expect, it } from "vitest";
import { buildBoardAccessContext, signRoomToken, verifyRoomToken } from "@whiteboard/shared";

describe("board access", () => {
  it("grants owner access", () => {
    const access = buildBoardAccessContext({
      boardId: "board-1",
      ownerId: "user-1",
      userId: "user-1",
    });

    expect(access.role).toBe("owner");
    expect(access.canEdit).toBe(true);
    expect(access.canManageSharing).toBe(true);
  });

  it("grants viewer access for a view share link without login", () => {
    const access = buildBoardAccessContext({
      boardId: "board-1",
      ownerId: "owner-1",
      userId: null,
      shareLinkId: "link-1",
      shareMode: "view",
    });

    expect(access.role).toBe("viewer");
    expect(access.canView).toBe(true);
    expect(access.canEdit).toBe(false);
  });

  it("requires auth for edit links", () => {
    const unauthenticated = buildBoardAccessContext({
      boardId: "board-1",
      ownerId: "owner-1",
      userId: null,
      shareLinkId: "link-1",
      shareMode: "edit",
    });
    const authenticated = buildBoardAccessContext({
      boardId: "board-1",
      ownerId: "owner-1",
      userId: "user-2",
      shareLinkId: "link-1",
      shareMode: "edit",
    });

    expect(unauthenticated.role).toBeNull();
    expect(authenticated.role).toBe("editor");
    expect(authenticated.canEdit).toBe(true);
  });
});

describe("room token", () => {
  it("signs and verifies claims", async () => {
    const token = await signRoomToken(
      {
        boardId: "board-1",
        userId: "user-1",
        role: "editor",
        name: "Ada Lovelace",
      },
      "test-secret",
    );

    const claims = await verifyRoomToken(token, "test-secret");
    expect(claims.boardId).toBe("board-1");
    expect(claims.userId).toBe("user-1");
    expect(claims.role).toBe("editor");
  });
});
