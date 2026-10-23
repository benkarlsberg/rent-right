import "server-only";
import { cookies, headers } from "next/headers";
import { readSession, signSession } from "@/lib/crypto";
import { getUser, type User } from "@/lib/db";
import type { Locale } from "@/lib/disclaimer";
import { adoptActor, requestMemo, withActor } from "@/lib/pg";
import { userIdFromSupabaseToken } from "@/lib/supabase-auth";

export { adoptActor };

const SESSION = "rr_session";

export async function sessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const headerList = await headers();
  const header = headerList.get("authorization");
  const bearer = header?.match(/^Bearer\s+(\S+)/i)?.[1];
  const token = bearer || jar.get(SESSION)?.value;
  return readSession(token) || (await userIdFromSupabaseToken(token));
}

export async function currentUser(): Promise<User | null> {
  return requestMemo("rr-user", async () => {
    const id = await sessionUserId();
    if (!id) return null;
    return (await getUser(id)) ?? null;
  });
}

export async function runAsUser<T>(user: User | null, fn: () => Promise<T>): Promise<T> {
  return withActor(user?.id ?? null, fn);
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION);
}

export async function readLocale(): Promise<Locale> {
  const user = await currentUser();
  if (user) return user.locale;
  const jar = await cookies();
  return jar.get("rr_locale")?.value === "es" ? "es" : "en";
}

export async function writeLocale(locale: Locale) {
  const jar = await cookies();
  jar.set("rr_locale", locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
