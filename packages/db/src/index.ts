import { mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildBoardAccessContext, type BoardAccessContext, type BoardMemberSummary, type BoardRole, type BoardSummary, type ShareLinkMode, type ShareLinkSummary } from "@whiteboard/shared";
import { boardMembers, boards, schema, shareLinks, user } from "./schema";

type Database = any;

declare global {
  // eslint-disable-next-line no-var
  var __whiteboardDb: Promise<Database> | undefined;
}

async function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.startsWith("postgres://")) {
    const client = postgres(databaseUrl, { prepare: false });
    return drizzlePostgres(client, { schema });
  }

  const location = join(process.cwd(), "data", "local-db");
  await mkdir(location, { recursive: true });
  const client = new PGlite(location);
  return drizzlePglite(client, { schema });
}

export async function getDb() {
  globalThis.__whiteboardDb ??= createDatabase();
  return globalThis.__whiteboardDb;
}

export async function ensureDatabase() {
  const db = await getDb();
  const statements = [
    `create table if not exists "user" (
      "id" text primary key,
      "name" text not null,
      "email" text not null unique,
      "email_verified" boolean not null default false,
      "image" text,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null
    )`,
    `create table if not exists "session" (
      "id" text primary key,
      "expires_at" timestamptz not null,
      "token" text not null unique,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      "ip_address" text,
      "user_agent" text,
      "user_id" text not null references "user"("id") on delete cascade
    )`,
    `create table if not exists "account" (
      "id" text primary key,
      "account_id" text not null,
      "provider_id" text not null,
      "user_id" text not null references "user"("id") on delete cascade,
      "access_token" text,
      "refresh_token" text,
      "id_token" text,
      "access_token_expires_at" timestamptz,
      "refresh_token_expires_at" timestamptz,
      "scope" text,
      "password" text,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null
    )`,
    `create table if not exists "verification" (
      "id" text primary key,
      "identifier" text not null,
      "value" text not null,
      "expires_at" timestamptz not null,
      "created_at" timestamptz,
      "updated_at" timestamptz
    )`,
    `create table if not exists "boards" (
      "id" text primary key,
      "name" text not null,
      "owner_id" text not null references "user"("id") on delete cascade,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      "latest_snapshot" jsonb
    )`,
    `create table if not exists "board_members" (
      "board_id" text not null references "boards"("id") on delete cascade,
      "user_id" text not null references "user"("id") on delete cascade,
      "role" text not null,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      primary key ("board_id", "user_id")
    )`,
    `create table if not exists "share_links" (
      "id" text primary key,
      "board_id" text not null references "boards"("id") on delete cascade,
      "token_hash" text not null unique,
      "mode" text not null,
      "created_by_user_id" text not null references "user"("id") on delete cascade,
      "revoked_at" timestamptz,
      "created_at" timestamptz not null
    )`,
  ];

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function listBoardsForUser(userId: string): Promise<BoardSummary[]> {
  const db = await getDb();
  const owned = await db
    .select({
      id: boards.id,
      name: boards.name,
      ownerId: boards.ownerId,
      updatedAt: boards.updatedAt,
      createdAt: boards.createdAt,
      role: sql<BoardRole>`'owner'`,
    })
    .from(boards)
    .where(eq(boards.ownerId, userId));

  const shared = await db
    .select({
      id: boards.id,
      name: boards.name,
      ownerId: boards.ownerId,
      updatedAt: boards.updatedAt,
      createdAt: boards.createdAt,
      role: boardMembers.role,
    })
    .from(boardMembers)
    .innerJoin(boards, eq(boardMembers.boardId, boards.id))
    .where(eq(boardMembers.userId, userId));

  return [...owned, ...shared].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function createBoard(input: { ownerId: string; name?: string }) {
  const db = await getDb();
  const now = new Date();
  const boardId = randomUUID();
  await db.insert(boards).values({
    id: boardId,
    name: input.name?.trim() || "Untitled board",
    ownerId: input.ownerId,
    createdAt: now,
    updatedAt: now,
    latestSnapshot: null,
  });
  return boardId;
}

export async function renameBoard(input: { boardId: string; ownerId: string; name: string }) {
  const db = await getDb();
  await db
    .update(boards)
    .set({ name: input.name.trim() || "Untitled board", updatedAt: new Date() })
    .where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId)));
}

export async function deleteBoard(input: { boardId: string; ownerId: string }) {
  const db = await getDb();
  await db.delete(boards).where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId)));
}

export async function getBoardById(boardId: string) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  return board ?? null;
}

export async function resolveBoardAccess(input: { boardId: string; userId: string | null; shareToken?: string | null }): Promise<{ board: Awaited<ReturnType<typeof getBoardById>>; access: BoardAccessContext | null }> {
  const db = await getDb();
  const board = await getBoardById(input.boardId);
  if (!board) {
    return { board: null, access: null };
  }

  const [member] = input.userId
    ? await db
        .select({ role: boardMembers.role })
        .from(boardMembers)
        .where(and(eq(boardMembers.boardId, input.boardId), eq(boardMembers.userId, input.userId)))
        .limit(1)
    : [];

  const [shareLink] = input.shareToken
    ? await db
        .select({ id: shareLinks.id, mode: shareLinks.mode })
        .from(shareLinks)
        .where(and(eq(shareLinks.boardId, input.boardId), eq(shareLinks.tokenHash, hashShareToken(input.shareToken)), isNull(shareLinks.revokedAt)))
        .limit(1)
    : [];

  return {
    board,
    access: buildBoardAccessContext({
      boardId: board.id,
      ownerId: board.ownerId,
      userId: input.userId,
      memberRole: member?.role ?? null,
      shareLinkId: shareLink?.id ?? null,
      shareMode: shareLink?.mode ?? null,
    }),
  };
}

export async function listBoardMembers(boardId: string): Promise<BoardMemberSummary[]> {
  const db = await getDb();
  const rows = await db
    .select({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: boardMembers.role,
    })
    .from(boardMembers)
    .innerJoin(user, eq(boardMembers.userId, user.id))
    .where(eq(boardMembers.boardId, boardId));

  return rows;
}

export async function addBoardMemberByEmail(input: { boardId: string; ownerId: string; email: string; role: "editor" | "viewer" }) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId))).limit(1);
  if (!board) {
    throw new Error("Board not found or owner mismatch");
  }

  const [targetUser] = await db.select().from(user).where(eq(user.email, input.email.trim().toLowerCase())).limit(1);
  if (!targetUser) {
    throw new Error("User not found. Invite existing users only in MVP.");
  }

  if (targetUser.id === board.ownerId) {
    return;
  }

  const now = new Date();
  await db
    .insert(boardMembers)
    .values({
      boardId: input.boardId,
      userId: targetUser.id,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [boardMembers.boardId, boardMembers.userId],
      set: { role: input.role, updatedAt: now },
    });
}

export async function updateBoardMemberRole(input: { boardId: string; ownerId: string; userId: string; role: "editor" | "viewer" }) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId))).limit(1);
  if (!board) {
    throw new Error("Board not found or owner mismatch");
  }

  await db
    .update(boardMembers)
    .set({ role: input.role, updatedAt: new Date() })
    .where(and(eq(boardMembers.boardId, input.boardId), eq(boardMembers.userId, input.userId)));
}

export async function removeBoardMember(input: { boardId: string; ownerId: string; userId: string }) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId))).limit(1);
  if (!board) {
    throw new Error("Board not found or owner mismatch");
  }

  await db.delete(boardMembers).where(and(eq(boardMembers.boardId, input.boardId), eq(boardMembers.userId, input.userId)));
}

export async function createShareLink(input: { boardId: string; ownerId: string; mode: ShareLinkMode }) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId))).limit(1);
  if (!board) {
    throw new Error("Board not found or owner mismatch");
  }

  const rawToken = randomUUID().replace(/-/g, "");
  const id = randomUUID();
  await db.insert(shareLinks).values({
    id,
    boardId: input.boardId,
    tokenHash: hashShareToken(rawToken),
    mode: input.mode,
    createdByUserId: input.ownerId,
    createdAt: new Date(),
    revokedAt: null,
  });

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  return {
    id,
    token: rawToken,
    url: `${baseUrl}/b/${input.boardId}?share=${rawToken}`,
  };
}

export async function listShareLinks(boardId: string): Promise<Array<Omit<ShareLinkSummary, "url"> & { tokenHash?: never }>> {
  const db = await getDb();
  return db.select({ id: shareLinks.id, mode: shareLinks.mode, createdAt: shareLinks.createdAt, revokedAt: shareLinks.revokedAt }).from(shareLinks).where(eq(shareLinks.boardId, boardId)).orderBy(desc(shareLinks.createdAt));
}

export async function revokeShareLink(input: { boardId: string; ownerId: string; linkId: string }) {
  const db = await getDb();
  const [board] = await db.select().from(boards).where(and(eq(boards.id, input.boardId), eq(boards.ownerId, input.ownerId))).limit(1);
  if (!board) {
    throw new Error("Board not found or owner mismatch");
  }

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.id, input.linkId), eq(shareLinks.boardId, input.boardId), isNull(shareLinks.revokedAt)));
}

export async function getUsersByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }
  const db = await getDb();
  return db.select().from(user).where(inArray(user.id, userIds));
}

export async function saveBoardSnapshot(boardId: string, snapshot: unknown) {
  const db = await getDb();
  await db.update(boards).set({ latestSnapshot: snapshot as any, updatedAt: new Date() }).where(eq(boards.id, boardId));
}

export async function getBoardSnapshot(boardId: string) {
  const db = await getDb();
  const [result] = await db.select({ latestSnapshot: boards.latestSnapshot }).from(boards).where(eq(boards.id, boardId)).limit(1);
  return result?.latestSnapshot ?? null;
}

export { schema, user, session, account, verification, boards, boardMembers, shareLinks } from "./schema";
