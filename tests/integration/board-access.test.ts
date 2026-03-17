import { beforeEach, describe, expect, it } from "vitest";
import { account, addBoardMemberByEmail, boardMembers, boards, createBoard, createShareLink, ensureDatabase, getDb, resolveBoardAccess, session, shareLinks, user, verification } from "@whiteboard/db";

async function resetDatabase() {
  const db = await getDb();
  await db.delete(boardMembers);
  await db.delete(shareLinks);
  await db.delete(boards);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verification);
  await db.delete(user);
}

async function seedUsers() {
  const db = await getDb();
  const now = new Date();
  await db.insert(user).values([
    {
      id: "owner-1",
      name: "Owner User",
      email: "owner@example.com",
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "editor-1",
      name: "Editor User",
      email: "editor@example.com",
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

describe("board access integration", () => {
  beforeEach(async () => {
    process.env.APP_URL = "http://localhost:3000";
    await ensureDatabase();
    await resetDatabase();
    await seedUsers();
  });

  it("resolves member access", async () => {
    const boardId = await createBoard({ ownerId: "owner-1", name: "Sprint board" });
    await addBoardMemberByEmail({
      boardId,
      ownerId: "owner-1",
      email: "editor@example.com",
      role: "editor",
    });

    const { access } = await resolveBoardAccess({ boardId, userId: "editor-1" });
    expect(access?.role).toBe("editor");
    expect(access?.canEdit).toBe(true);
  });

  it("resolves share link access", async () => {
    const boardId = await createBoard({ ownerId: "owner-1", name: "Share board" });
    const shareLink = await createShareLink({
      boardId,
      ownerId: "owner-1",
      mode: "view",
    });

    const { access } = await resolveBoardAccess({ boardId, userId: null, shareToken: shareLink.token });
    expect(access?.role).toBe("viewer");
    expect(access?.shareMode).toBe("view");
  });
});
