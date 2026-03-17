import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  createSessionCookie,
  getSessionFromHeaders,
  getSessionTokenFromHeaders,
  signInEmail,
  signOut,
  signUpEmail,
} from "@whiteboard/auth";

export const dynamic = "force-dynamic";

function getAuthPath(request: Request) {
  const pathname = new URL(request.url).pathname;
  return pathname.replace(/^\/api\/auth/, "") || "/";
}

export async function GET(request: Request) {
  const path = getAuthPath(request);

  if (path === "/get-session") {
    const session = await getSessionFromHeaders(request.headers);
    return NextResponse.json(session);
  }

  return NextResponse.json({ message: "Not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const path = getAuthPath(request);
  const body = await request.json().catch(() => ({}));

  try {
    if (path === "/sign-up/email") {
      const { token, user } = await signUpEmail({
        name: typeof body.name === "string" ? body.name : "",
        email: typeof body.email === "string" ? body.email : "",
        password: typeof body.password === "string" ? body.password : "",
        headers: request.headers,
      });

      const response = NextResponse.json({ user });
      response.headers.set("set-cookie", createSessionCookie(token));
      return response;
    }

    if (path === "/sign-in/email") {
      const { token, user } = await signInEmail({
        email: typeof body.email === "string" ? body.email : "",
        password: typeof body.password === "string" ? body.password : "",
        headers: request.headers,
      });

      const response = NextResponse.json({ user });
      response.headers.set("set-cookie", createSessionCookie(token));
      return response;
    }

    if (path === "/sign-in/social") {
      return NextResponse.json(
        { message: "Google sign-in is not enabled in the local MVP build yet." },
        { status: 501 },
      );
    }

    if (path === "/sign-out") {
      const token = await getSessionTokenFromHeaders(request.headers);
      await signOut(token);

      const response = NextResponse.json({ ok: true });
      response.headers.set("set-cookie", clearSessionCookie());
      return response;
    }

    return NextResponse.json({ message: "Not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Authentication failed" },
      { status: 400 },
    );
  }
}
