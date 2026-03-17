import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionFromHeaders } from "@whiteboard/auth";

export async function getServerSession() {
  const requestHeaders = await headers();
  return getSessionFromHeaders(requestHeaders);
}

export async function requireSession() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
