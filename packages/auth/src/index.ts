import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { ensureDatabase, getDb, schema } from "@whiteboard/db";

let authPromise: Promise<any> | undefined;

export async function getAuth() {
  authPromise ??= (async () => {
    await ensureDatabase();
    const db = await getDb();
    const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    return betterAuth({
      secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
      baseURL: process.env.APP_URL ?? "http://localhost:3000",
      basePath: "/api/auth",
      trustedOrigins: [process.env.APP_URL ?? "http://localhost:3000"],
      database: drizzleAdapter(db, {
        provider: "pg",
        schema,
      }),
      emailAndPassword: {
        enabled: true,
        autoSignIn: true,
      },
      socialProviders: googleEnabled
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            },
          }
        : {},
      plugins: [nextCookies()],
      user: {
        additionalFields: {},
      },
    });
  })();

  return authPromise as Promise<ReturnType<typeof betterAuth>>;
}
