import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { documentPatchSchema, uuid } from "@/lib/validate";

type Ctx = { params: { id: string } };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const id = uuid.parse(params.id);
  const [document] = await query(
    "SELECT * FROM document_overview WHERE id = $1 AND user_id = $2",
    [id, me.id]
  );
  if (!document) throw new HttpError(404, "Document not found");
  const chunks = await query(
    "SELECT id, chunk_index, content, (embedding IS NOT NULL) AS embedded FROM chunks WHERE document_id = $1 ORDER BY chunk_index",
    [id]
  );
  return ok({ document, chunks });
});

// UPDATE title and/or folder (trigger trg_folder_owner blocks folders owned by someone else)
export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const id = uuid.parse(params.id);
  const body = documentPatchSchema.parse(await req.json());
  const sets: string[] = [];
  const values: unknown[] = [id, me.id];
  if (body.title !== undefined) {
    values.push(body.title);
    sets.push(`title = $${values.length}`);
  }
  if (body.folderId !== undefined) {
    values.push(body.folderId);
    sets.push(`folder_id = $${values.length}`);
  }
  if (!sets.length) throw new HttpError(400, "Nothing to update");
  const rows = await query(
    `UPDATE documents SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2 RETURNING id, title, folder_id`,
    values
  );
  if (!rows[0]) throw new HttpError(404, "Document not found");
  return ok({ document: rows[0] });
});

// DELETE cascades to chunks (FK ON DELETE CASCADE)
export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireUser();
  const id = uuid.parse(params.id);
  const rows = await query<{ storage_path: string | null }>(
    "DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING storage_path",
    [id, me.id]
  );
  if (!rows[0]) throw new HttpError(404, "Document not found");
  if (rows[0].storage_path) await fs.unlink(rows[0].storage_path).catch(() => {});
  return ok({ deleted: id });
});
