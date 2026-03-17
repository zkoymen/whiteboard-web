import {
  createSession,
  createUser,
  deleteSession,
  ensureDatabase,
  getUserBySessionToken,
  validateUserCredentials,
} from "@whiteboard/db";

export const SESSION_COOKIE_NAME = "whiteboard_session";

type HeaderBag = Headers | { get(name: string): string | null | undefined };

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUserBySessionToken>>>;

export type AuthSession = {
  user: SessionUser;
};

function parseCookieHeader(cookieHeader: string | null | undefined) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) {
      continue;
    }
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

function getHeader(headers: HeaderBag, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? null;
}

function buildCookie(token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function getClientMetadata(headers?: HeaderBag) {
  return {
    ipAddress: getHeader(headers ?? new Headers(), "x-forwarded-for"),
    userAgent: getHeader(headers ?? new Headers(), "user-agent"),
  };
}

export function createSessionCookie(token: string) {
  return buildCookie(token, 60 * 60 * 24 * 14);
}

export function clearSessionCookie() {
  return buildCookie("", 0);
}

export async function signUpEmail(input: {
  name: string;
  email: string;
  password: string;
  headers?: HeaderBag;
}) {
  await ensureDatabase();

  const name = input.name.trim();
  const email = input.email.trim();
  const password = input.password;

  if (!name) {
    throw new Error("Name is required");
  }
  if (!email) {
    throw new Error("Email is required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const user = await createUser({ name, email, password });
  const token = await createSession({
    userId: user.id,
    ...getClientMetadata(input.headers),
  });

  return { token, user };
}

export async function signInEmail(input: {
  email: string;
  password: string;
  headers?: HeaderBag;
}) {
  await ensureDatabase();

  const user = await validateUserCredentials(input.email, input.password);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const token = await createSession({
    userId: user.id,
    ...getClientMetadata(input.headers),
  });

  return { token, user };
}

export async function signOut(sessionToken: string | null | undefined) {
  await ensureDatabase();

  if (sessionToken) {
    await deleteSession(sessionToken);
  }
}

export async function getSessionFromHeaders(headers: HeaderBag): Promise<AuthSession | null> {
  await ensureDatabase();

  const cookieHeader = getHeader(headers, "cookie");
  const sessionToken = parseCookieHeader(cookieHeader).get(SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return null;
  }

  const user = await getUserBySessionToken(sessionToken);
  if (!user) {
    return null;
  }

  return { user };
}

export async function getSessionTokenFromHeaders(headers: HeaderBag) {
  const cookieHeader = getHeader(headers, "cookie");
  return parseCookieHeader(cookieHeader).get(SESSION_COOKIE_NAME) ?? null;
}
