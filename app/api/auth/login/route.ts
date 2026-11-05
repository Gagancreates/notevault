import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { HttpError, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validate";

export const POST = handle(async (req: NextRequest) => {
  const body = loginSchema.parse(await req.json());
  const [user] = await query("SELECT * FROM verify_login($1, $2)", [body.email, body.password]);
  if (!user) throw new HttpError(401, "Wrong e-mail or password");
  return setSessionCookie(ok({ user }), user);
});
