import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { roleSchema, uuid } from "@/lib/validate";

type Ctx = { params: { id: string } };

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const admin = await requireAdmin();
  const id = uuid.parse(params.id);
  const { role } = roleSchema.parse(await req.json());
  if (id === admin.id && role !== "admin") throw new HttpError(400, "You can't remove your own admin role");
  const rows = await query("UPDATE users SET role = $2 WHERE id = $1 RETURNING id, role", [id, role]);
  if (!rows[0]) throw new HttpError(404, "User not found");
  return ok({ user: rows[0] });
});

// Deleting a user cascades to their folders, documents, chunks and query logs
export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const admin = await requireAdmin();
  const id = uuid.parse(params.id);
  if (id === admin.id) throw new HttpError(400, "You can't delete your own account");
  const rows = await query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
  if (!rows[0]) throw new HttpError(404, "User not found");
  return ok({ deleted: id });
});
