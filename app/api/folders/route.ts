import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { folderSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

// SELECT with LEFT JOIN + GROUP BY: each folder with its document and chunk totals
export const GET = handle(async () => {
  const me = await requireUser();
  const folders = await query(
    `SELECT f.id, f.name, f.created_at,
            COUNT(d.id)::int                     AS documents,
            COALESCE(SUM(d.chunk_count), 0)::int AS chunks
     FROM folders f
     LEFT JOIN documents d ON d.folder_id = f.id
     WHERE f.user_id = $1
     GROUP BY f.id, f.name, f.created_at
     ORDER BY f.name`,
    [me.id]
  );
  const [unfiled] = await query(
    "SELECT COUNT(*)::int AS documents FROM documents WHERE user_id = $1 AND folder_id IS NULL",
    [me.id]
  );
  return ok({ folders, unfiled: unfiled.documents });
});

export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const { name } = folderSchema.parse(await req.json());
  const [folder] = await query(
    "INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at",
    [me.id, name]
  );
  return ok({ folder }, 201);
});
