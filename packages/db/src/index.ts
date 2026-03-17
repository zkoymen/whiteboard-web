import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildBoardAccessContext, type BoardAccessContext, type BoardMemberSummary, type BoardRole, type BoardSummary, type ShareLinkMode, type ShareLinkSummary } from "@whiteboard/shared";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoredSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type StoredBoard = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  latestSnapshot: unknown;
};

type StoredBoardMember = {
  boardId: string;
  userId: string;
  role: "editor" | "viewer";
  createdAt: string;
  updatedAt: string;
};

type StoredShareLink = {
  id: string;
  boardId: string;
  tokenHash: string;
  mode: ShareLinkMode;
  createdByUserId: string;
  revokedAt: string | null;
  createdAt: string;
};

type AppState = {
  users: StoredUser[];
  sessions: StoredSession[];
  boards: StoredBoard[];
  boardMembers: StoredBoardMember[];
  shareLinks: StoredShareLink[];
};

const EMPTY_STATE: AppState = {
  users: [],
  sessions: [],
  boards: [],
  boardMembers: [],
  shareLinks: [],
};

const STATE_FILE = resolve(process.env.INIT_CWD ?? process.cwd(), "data", "app-state.json");

let writeQueue = Promise.resolve();

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function toDate(value: string) {
  return new Date(value);
}

function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");
  return timingSafeEqual(derived, stored);
}

function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

async function readState(): Promise<AppState> {
  await ensureDatabase();
  const raw = await readFile(STATE_FILE, "utf8");
  return JSON.parse(raw) as AppState;
}

async function writeState(state: AppState) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function mutateState<T>(mutator: (state: AppState) => Promise<T> | T): Promise<T> {
  const run = async () => {
    const state = await readState();
    const nextState = cloneState(state);
    const result = await mutator(nextState);
    await writeState(nextState);
    return result;
  };

  const resultPromise = writeQueue.then(run);
  writeQueue = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

export async function ensureDatabase() {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  try {
    await readFile(STATE_FILE, "utf8");
  } catch {
    await writeState(EMPTY_STATE);
  }
}

export async function getDb() {
  return readState();
}

export async function createUser(input: { name: string; email: string; password: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  return mutateState((state) => {
    if (state.users.some((user) => user.email === normalizedEmail)) {
      throw new Error("Email already exists");
    }

    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(input.password),
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    };
    state.users.push(user);
    return publicUser(user);
  });
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const state = await readState();
  const user = state.users.find((entry) => entry.email === normalizedEmail);
  return user ? publicUser(user) : null;
}

export async function validateUserCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const state = await readState();
  const user = state.users.find((entry) => entry.email === normalizedEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }
  return publicUser(user);
}

export async function createSession(input: { userId: string; ipAddress?: string | null; userAgent?: string | null }) {
  return mutateState((state) => {
    const now = new Date();
    const session: StoredSession = {
      id: randomUUID(),
      token: randomBytes(24).toString("hex"),
      userId: input.userId,
      expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    };
    state.sessions.push(session);
    return session.token;
  });
}

export async function getUserBySessionToken(token: string) {
  const now = new Date();
  const state = await readState();
  const session = state.sessions.find((entry) => entry.token === token && new Date(entry.expiresAt) > now);
  if (!session) {
    return null;
  }
  const user = state.users.find((entry) => entry.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function deleteSession(token: string) {
  return mutateState((state) => {
    state.sessions = state.sessions.filter((entry) => entry.token !== token);
  });
}

export async function listBoardsForUser(userId: string): Promise<BoardSummary[]> {
  const state = await readState();
  const owned = state.boards
    .filter((board) => board.ownerId === userId)
    .map((board) => ({
      id: board.id,
      name: board.name,
      ownerId: board.ownerId,
      createdAt: toDate(board.createdAt),
      updatedAt: toDate(board.updatedAt),
      role: "owner" as const,
    }));

  const shared = state.boardMembers
    .filter((member) => member.userId === userId)
    .map((member) => {
      const board = state.boards.find((entry) => entry.id === member.boardId);
      if (!board) {
        return null;
      }
      return {
        id: board.id,
        name: board.name,
        ownerId: board.ownerId,
        createdAt: toDate(board.createdAt),
        updatedAt: toDate(board.updatedAt),
        role: member.role,
      };
    })
    .filter(Boolean) as BoardSummary[];

  return [...owned, ...shared].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function createBoard(input: { ownerId: string; name?: string }) {
  return mutateState((state) => {
    const now = new Date().toISOString();
    const boardId = randomUUID();
    state.boards.push({
      id: boardId,
      name: input.name?.trim() || "Untitled board",
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
      latestSnapshot: null,
    });
    return boardId;
  });
}

export async function renameBoard(input: { boardId: string; ownerId: string; name: string }) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === input.boardId && entry.ownerId === input.ownerId);
    if (board) {
      board.name = input.name.trim() || "Untitled board";
      board.updatedAt = new Date().toISOString();
    }
  });
}

export async function deleteBoard(input: { boardId: string; ownerId: string }) {
  return mutateState((state) => {
    state.boards = state.boards.filter((entry) => !(entry.id === input.boardId && entry.ownerId === input.ownerId));
    state.boardMembers = state.boardMembers.filter((entry) => entry.boardId !== input.boardId);
    state.shareLinks = state.shareLinks.filter((entry) => entry.boardId !== input.boardId);
  });
}

export async function getBoardById(boardId: string) {
  const state = await readState();
  const board = state.boards.find((entry) => entry.id === boardId);
  if (!board) {
    return null;
  }

  return {
    id: board.id,
    name: board.name,
    ownerId: board.ownerId,
    createdAt: toDate(board.createdAt),
    updatedAt: toDate(board.updatedAt),
    latestSnapshot: board.latestSnapshot,
  };
}

export async function resolveBoardAccess(input: { boardId: string; userId: string | null; shareToken?: string | null }): Promise<{ board: Awaited<ReturnType<typeof getBoardById>>; access: BoardAccessContext | null }> {
  const state = await readState();
  const board = state.boards.find((entry) => entry.id === input.boardId);
  if (!board) {
    return { board: null, access: null };
  }

  const member = input.userId ? state.boardMembers.find((entry) => entry.boardId === input.boardId && entry.userId === input.userId) : null;
  const shareToken = input.shareToken ?? null;
  const shareLink = shareToken
    ? state.shareLinks.find((entry) => entry.boardId === input.boardId && entry.tokenHash === hashShareToken(shareToken) && !entry.revokedAt)
    : null;

  const hydratedBoard = {
    id: board.id,
    name: board.name,
    ownerId: board.ownerId,
    createdAt: toDate(board.createdAt),
    updatedAt: toDate(board.updatedAt),
    latestSnapshot: board.latestSnapshot,
  };

  return {
    board: hydratedBoard,
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
  const state = await readState();
  return state.boardMembers
    .filter((member) => member.boardId === boardId)
    .map((member) => {
      const foundUser = state.users.find((entry) => entry.id === member.userId);
      if (!foundUser) {
        return null;
      }
      return {
        userId: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: member.role,
      };
    })
    .filter(Boolean) as BoardMemberSummary[];
}

export async function addBoardMemberByEmail(input: { boardId: string; ownerId: string; email: string; role: "editor" | "viewer" }) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === input.boardId && entry.ownerId === input.ownerId);
    if (!board) {
      throw new Error("Board not found or owner mismatch");
    }

    const targetUser = state.users.find((entry) => entry.email === input.email.trim().toLowerCase());
    if (!targetUser) {
      throw new Error("User not found. Invite existing users only in MVP.");
    }

    if (targetUser.id === board.ownerId) {
      return;
    }

    const now = new Date().toISOString();
    const existing = state.boardMembers.find((entry) => entry.boardId === input.boardId && entry.userId === targetUser.id);
    if (existing) {
      existing.role = input.role;
      existing.updatedAt = now;
      return;
    }

    state.boardMembers.push({
      boardId: input.boardId,
      userId: targetUser.id,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function updateBoardMemberRole(input: { boardId: string; ownerId: string; userId: string; role: "editor" | "viewer" }) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === input.boardId && entry.ownerId === input.ownerId);
    if (!board) {
      throw new Error("Board not found or owner mismatch");
    }

    const member = state.boardMembers.find((entry) => entry.boardId === input.boardId && entry.userId === input.userId);
    if (member) {
      member.role = input.role;
      member.updatedAt = new Date().toISOString();
    }
  });
}

export async function removeBoardMember(input: { boardId: string; ownerId: string; userId: string }) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === input.boardId && entry.ownerId === input.ownerId);
    if (!board) {
      throw new Error("Board not found or owner mismatch");
    }
    state.boardMembers = state.boardMembers.filter((entry) => !(entry.boardId === input.boardId && entry.userId === input.userId));
  });
}

export async function createShareLink(input: { boardId: string; ownerId: string; mode: ShareLinkMode }) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === input.boardId && entry.ownerId === input.ownerId);
    if (!board) {
      throw new Error("Board not found or owner mismatch");
    }

    const rawToken = randomUUID().replace(/-/g, "");
    const id = randomUUID();
    state.shareLinks.push({
      id,
      boardId: input.boardId,
      tokenHash: hashShareToken(rawToken),
      mode: input.mode,
      createdByUserId: input.ownerId,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    });

    const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
    return {
      id,
      token: rawToken,
      url: `${baseUrl}/b/${input.boardId}?share=${rawToken}`,
    };
  });
}

export async function listShareLinks(boardId: string): Promise<Array<Omit<ShareLinkSummary, "url"> & { tokenHash?: never }>> {
  const state = await readState();
  return state.shareLinks
    .filter((entry) => entry.boardId === boardId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((entry) => ({
      id: entry.id,
      mode: entry.mode,
      createdAt: toDate(entry.createdAt),
      revokedAt: entry.revokedAt ? toDate(entry.revokedAt) : null,
    }));
}

export async function revokeShareLink(input: { boardId: string; ownerId: string; linkId: string }) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === input.boardId && entry.ownerId === input.ownerId);
    if (!board) {
      throw new Error("Board not found or owner mismatch");
    }
    const link = state.shareLinks.find((entry) => entry.id === input.linkId && entry.boardId === input.boardId && !entry.revokedAt);
    if (link) {
      link.revokedAt = new Date().toISOString();
    }
  });
}

export async function getUsersByIds(userIds: string[]) {
  const state = await readState();
  return state.users.filter((entry) => userIds.includes(entry.id)).map(publicUser);
}

export async function saveBoardSnapshot(boardId: string, snapshot: unknown) {
  return mutateState((state) => {
    const board = state.boards.find((entry) => entry.id === boardId);
    if (board) {
      board.latestSnapshot = snapshot;
      board.updatedAt = new Date().toISOString();
    }
  });
}

export async function getBoardSnapshot(boardId: string) {
  const state = await readState();
  return state.boards.find((entry) => entry.id === boardId)?.latestSnapshot ?? null;
}
