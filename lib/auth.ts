import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "./db";
import { SESSION_COOKIE, Session, signSession, verifySession } from "./session";

export async function getSession(): Promise<Session | null> {
  const s = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // Re-check against the database so deleted users or changed roles take effect immediately.
  const rows = await query<{ role: "admin" | "user"; name: string }>(
    "SELECT role, name FROM users WHERE id = $1",
    [s.id]
  );
  if (!rows[0]) return null;
  return { ...s, role: rows[0].role, name: rows[0].name };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Please log in");
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireUser();
  if (s.role !== "admin") throw new HttpError(403, "Admins only");
  return s;
}

export async function setSessionCookie(res: NextResponse, s: Session) {
  res.cookies.set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
