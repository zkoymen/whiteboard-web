import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const boardRoleSchema = z.enum(["owner", "editor", "viewer"]);
export const shareLinkModeSchema = z.enum(["view", "edit"]);

export type BoardRole = z.infer<typeof boardRoleSchema>;
export type ShareLinkMode = z.infer<typeof shareLinkModeSchema>;

export type BoardSummary = {
  id: string;
  name: string;
  role: BoardRole;
  ownerId: string;
  updatedAt: Date;
  createdAt: Date;
};

export type ShareLinkSummary = {
  id: string;
  mode: ShareLinkMode;
  createdAt: Date;
  revokedAt: Date | null;
  url: string;
};

export type BoardMemberSummary = {
  userId: string;
  email: string;
  name: string;
  role: Exclude<BoardRole, "owner">;
};

export type BoardAccessContext = {
  boardId: string;
  role: BoardRole | null;
  source: "owner" | "member" | "share-link" | "none";
  userId: string | null;
  shareLinkId: string | null;
  shareMode: ShareLinkMode | null;
  canView: boolean;
  canEdit: boolean;
  canManageSharing: boolean;
};

export const roomTokenClaimsSchema = z.object({
  boardId: z.string().min(1),
  userId: z.string().nullable(),
  role: boardRoleSchema,
  name: z.string().min(1),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type RoomTokenClaims = z.infer<typeof roomTokenClaimsSchema>;

export function isEditableRole(role: BoardRole | null): role is "owner" | "editor" {
  return role === "owner" || role === "editor";
}

export function canManageSharing(role: BoardRole | null): boolean {
  return role === "owner";
}

export function buildBoardAccessContext(input: {
  boardId: string;
  ownerId: string;
  userId: string | null;
  memberRole?: Exclude<BoardRole, "owner"> | null;
  shareLinkId?: string | null;
  shareMode?: ShareLinkMode | null;
}): BoardAccessContext {
  const { boardId, ownerId, userId, memberRole = null, shareLinkId = null, shareMode = null } = input;

  let role: BoardRole | null = null;
  let source: BoardAccessContext["source"] = "none";

  if (userId && userId === ownerId) {
    role = "owner";
    source = "owner";
  } else if (memberRole) {
    role = memberRole;
    source = "member";
  } else if (shareMode === "view") {
    role = "viewer";
    source = "share-link";
  } else if (shareMode === "edit" && userId) {
    role = "editor";
    source = "share-link";
  }

  return {
    boardId,
    role,
    source,
    userId,
    shareLinkId,
    shareMode,
    canView: role !== null,
    canEdit: isEditableRole(role),
    canManageSharing: canManageSharing(role),
  };
}

function getJwtSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signRoomToken(claims: Omit<RoomTokenClaims, "iat" | "exp">, secret: string, expiresIn = "1h") {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret(secret));
}

export async function verifyRoomToken(token: string, secret: string) {
  const result = await jwtVerify(token, getJwtSecret(secret));
  return roomTokenClaimsSchema.parse(result.payload);
}
