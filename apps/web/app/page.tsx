export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getServerSession } from "../lib/session";

export default async function HomePage() {
  const session = await getServerSession();
  redirect(session?.user ? "/boards" : "/login");
}

