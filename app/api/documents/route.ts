import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { query, toVector, withTransaction } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { chunkText } from "@/lib/chunker";
import { embed } from "@/lib/embed";
import { detectType, extractText } from "@/lib/parse";
import { uuid } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;

const SORTS: Record<string, string> = {
  newest: "uploaded_at DESC",
  oldest: "uploaded_at ASC",
  title: "lower(title) ASC",
  chunks: "chunk_count DESC",
};

// List documents from the document_overview view with filtering and sorting
export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const sp = req.nextUrl.searchParams;
  const where = ["user_id = $1"];
  const params: unknown[] = [me.id];

  const folder = sp.get("folder");
  if (folder === "unfiled") where.push("folder_id IS NULL");
  else if (folder && folder !== "all") {
    params.push(uuid.parse(folder));
    where.push(`folder_id = $${params.length}`);
  }
  const status = sp.get("status");
  if (status === "ready" || status === "pending") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const q = sp.get("q")?.trim();
  if (q) {
    params.push(`%${q}%`);
    where.push(`title ILIKE $${params.length}`);
  }
  const order = SORTS[sp.get("sort") || "newest"] || SORTS.newest;

  const documents = await query(
    `SELECT id, title, file_type, status, chunk_count, uploaded_at, folder_id, folder_name
     FROM document_overview WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 200`,
    params
  );
  return ok({ documents });
});

// Upload pipeline: parse → chunk → embed, then ONE transaction inserts the document and all chunks.
// If anything fails inside the transaction, nothing is saved (no orphan document).
export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload");
  if (file.size === 0) throw new HttpError(400, "That file is empty");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Files must be 10 MB or smaller");

  const type = detectType(file.name);
  const folderRaw = form.get("folderId");
  const folderId = folderRaw ? uuid.parse(String(folderRaw)) : null;
  const title =
    String(form.get("title") || "").trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 200);

  const buf = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buf, type);
  const pieces = chunkText(text);
  if (pieces.length === 0) throw new HttpError(400, "No readable text found in that file");

  const vectors = await embed(pieces);

  const doc = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO documents (user_id, folder_id, title, file_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [me.id, folderId, title, type]
    );
    const docId: string = rows[0].id;

    // Multi-row INSERT of chunks with their embeddings (trigger sets status = 'ready')
    const values: string[] = [];
    const params: unknown[] = [docId];
    pieces.forEach((content, i) => {
      params.push(i, content, toVector(vectors[i]));
      const b = params.length;
      values.push(`($1, $${b - 2}, $${b - 1}, $${b}::vector)`);
    });
    await c.query(
      `INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES ${values.join(",")}`,
      params
    );

    const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", me.id);
    await fs.mkdir(dir, { recursive: true });
    const stored = path.join(dir, `${docId}.${type}`);
    await fs.writeFile(stored, buf);
    await c.query("UPDATE documents SET storage_path = $2 WHERE id = $1", [docId, stored]);

    const { rows: final } = await c.query(
      "SELECT id, title, status, chunk_count FROM documents WHERE id = $1",
      [docId]
    );
    return final[0];
  });

  return ok({ document: doc }, 201);
});
