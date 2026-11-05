import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Maps PostgreSQL error codes to HTTP responses so DB-level validation reaches the user. */
function fromPg(e: any): { status: number; message: string } | null {
  if (!e || typeof e.code !== "string") return null;
  switch (e.code) {
    case "23505":
      if (String(e.constraint).includes("email")) return { status: 409, message: "That e-mail is already registered" };
      if (String(e.constraint).includes("folders")) return { status: 409, message: "You already have a folder with that name" };
      return { status: 409, message: "That record already exists" };
    case "23514":
      return { status: 400, message: e.constraint ? `Invalid value (${e.constraint})` : e.message };
    case "23503":
      return { status: 400, message: "Referenced record does not exist" };
    case "22023":
    case "22P02":
      return { status: 400, message: e.code === "22P02" ? "Invalid id" : e.message };
    case "42501":
      return { status: 403, message: e.message };
    case "P0001":
      return { status: 400, message: e.message };
    default:
      return null;
  }
}

export function handle<A extends any[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e: any) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: e.issues.map((i) => i.message).join("; ") }, { status: 400 });
      const pg = fromPg(e);
      if (pg) return NextResponse.json({ error: pg.message }, { status: pg.status });
      console.error(e);
      return NextResponse.json({ error: e?.message || "Something went wrong" }, { status: 500 });
    }
  };
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
