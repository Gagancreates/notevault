import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { folderSchema, uuid } from "@/lib/validate";

type Ctx = { params: { id: string } };

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const id = uuid.parse(params.id);
  const { name } = folderSchema.parse(await req.json());
  const rows = await query(
    "UPDATE folders SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING id, name",
    [id, me.id, name]
  );
  if (!rows[0]) throw new HttpError(404, "Folder not found");
  return ok({ folder: rows[0] });
});

// Documents in a deleted folder become Unfiled (FK ON DELETE SET NULL)
export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const id = uuid.parse(params.id);
  const rows = await query("DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id", [id, me.id]);
  if (!rows[0]) throw new HttpError(404, "Folder not found");
  return ok({ deleted: id });
});
