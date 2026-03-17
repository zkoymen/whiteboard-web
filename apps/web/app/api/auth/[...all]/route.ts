import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@whiteboard/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth);
  return handler.POST(request);
}
