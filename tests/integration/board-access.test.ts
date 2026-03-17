import { beforeEach, describe, expect, it } from "vitest";
import { addBoardMemberByEmail, createBoard, createShareLink, createUser, ensureDatabase, resolveBoardAccess } from "@whiteboard/db";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const STATE_FILE = resolve(process.env.INIT_CWD ?? process.cwd(), "data", "app-state.json");

describe("board access integration", () => {
  beforeEach(async () => {
    process.env.APP_URL = "http://localhost:3000";
    await rm(STATE_FILE, { force: true });
    await ensureDatabase();
    await createUser({
      name: "Owner User",
      email: "owner@example.com",
      password: "password123",
    });
    await createUser({
      name: "Editor User",
      email: "editor@example.com",
      password: "password123",
    });
  });

  it("resolves member access", async () => {
    const owner = await resolveUserId("owner@example.com");
    const editor = await resolveUserId("editor@example.com");
    const boardId = await createBoard({ ownerId: owner, name: "Sprint board" });
    await addBoardMemberByEmail({
      boardId,
      ownerId: owner,
      email: "editor@example.com",
      role: "editor",
    });

    const { access } = await resolveBoardAccess({ boardId, userId: editor });
    expect(access?.role).toBe("editor");
    expect(access?.canEdit).toBe(true);
  });

  it("resolves share link access", async () => {
    const owner = await resolveUserId("owner@example.com");
    const boardId = await createBoard({ ownerId: owner, name: "Share board" });
    const shareLink = await createShareLink({
      boardId,
      ownerId: owner,
      mode: "view",
    });

    const { access } = await resolveBoardAccess({ boardId, userId: null, shareToken: shareLink.token });
    expect(access?.role).toBe("viewer");
    expect(access?.shareMode).toBe("view");
  });
});

async function resolveUserId(email: string) {
  const { findUserByEmail } = await import("@whiteboard/db");
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`Missing user for ${email}`);
  }
  return user.id;
}
