import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth";
import { signupSchema } from "@/lib/validate";

// INSERT via register_user(): the password is bcrypt-hashed inside PostgreSQL.
export const POST = handle(async (req: NextRequest) => {
  const body = signupSchema.parse(await req.json());
  const [row] = await query<{ id: string }>("SELECT register_user($1, $2, $3) AS id", [
    body.name,
    body.email,
    body.password,
  ]);
  const [user] = await query("SELECT id, name, email, role FROM users WHERE id = $1", [row.id]);
  return setSessionCookie(ok({ user }, 201), user);
});
