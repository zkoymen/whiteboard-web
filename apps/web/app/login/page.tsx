export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/login-form";
import { getServerSession } from "../../lib/session";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session?.user) {
    redirect("/boards");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-copy">
          <p className="eyebrow">Fast, shared, minimal</p>
          <h2>Draw together without setup friction.</h2>
          <p className="muted">Private boards by default, role-based sharing, and a simple canvas that opens fast.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}

