import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Vector self-join: chunks in OTHER documents most similar to the given chunk
export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const chunkId = uuid.parse(req.nextUrl.searchParams.get("chunk"));
  const related = await query(
    `SELECT c2.id AS chunk_id, d.id AS document_id, d.title, c2.chunk_index,
            left(c2.content, 280) AS preview,
            1 - (c2.embedding <=> c1.embedding) AS score
     FROM chunks c1
     JOIN documents d1 ON d1.id = c1.document_id AND d1.user_id = $2
     JOIN chunks c2    ON c2.document_id <> c1.document_id
     JOIN documents d  ON d.id = c2.document_id AND d.user_id = $2
     WHERE c1.id = $1
     ORDER BY c2.embedding <=> c1.embedding
     LIMIT 5`,
    [chunkId, me.id]
  );
  return ok({ related });
});
