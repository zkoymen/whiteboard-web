import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@whiteboard/auth";

export async function getServerSession() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  return auth.api.getSession({ headers: requestHeaders as any });
}

export async function requireSession() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
