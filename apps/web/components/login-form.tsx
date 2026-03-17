"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@whiteboard/ui";

async function authRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? "Authentication failed");
  }

  return payload;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      try {
        if (mode === "sign-up") {
          await authRequest("/sign-up/email", { name, email, password });
        } else {
          await authRequest("/sign-in/email", { email, password });
        }
        router.push("/boards");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Authentication failed");
      }
    });
  }

  async function onGoogleSignIn() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = await authRequest("/sign-in/social", {
          provider: "google",
          disableRedirect: false,
          callbackURL: "/boards",
        });
        if (payload?.url) {
          window.location.href = payload.url;
        }
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Google sign-in failed");
      }
    });
  }

  return (
    <Card className="auth-card">
      <div className="auth-header">
        <p className="eyebrow">Collaborative Whiteboard</p>
        <h1>{mode === "sign-in" ? "Continue to your boards" : "Create your account"}</h1>
        <p className="muted">Email/password is the primary MVP path. Google is enabled when provider keys are configured.</p>
      </div>

      <div className="auth-mode-switch">
        <Button className={mode === "sign-in" ? "is-active" : "is-secondary"} onClick={() => setMode("sign-in")}>Sign in</Button>
        <Button className={mode === "sign-up" ? "is-active" : "is-secondary"} onClick={() => setMode("sign-up")}>Sign up</Button>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "sign-up" ? <Input name="name" placeholder="Your name" required /> : null}
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Password" required minLength={8} />
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={isPending}>{isPending ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}</Button>
      </form>

      <div className="auth-divider"><span>or</span></div>
      <Button className="is-secondary" onClick={onGoogleSignIn} disabled={isPending}>Continue with Google</Button>
    </Card>
  );
}
