import { NextRequest } from "next/server";
import { query, toVector } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { embed } from "@/lib/embed";
import { searchSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Highlight markers rendered safely by the client (no HTML injection)
const HL = `'MaxWords=45, MinWords=20, MaxFragments=2, FragmentDelimiter=" … ", StartSel=⟦, StopSel=⟧'`;

export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const { query: q, mode, k } = searchSchema.parse(await req.json());
  const started = Date.now();
  let results: any[];

  if (mode === "keyword") {
    // Full-text search on the GIN index, ranked with ts_rank_cd
    results = await query(
      `SELECT c.id AS chunk_id, d.id AS document_id, d.title, COALESCE(f.name, 'Unfiled') AS folder,
              c.chunk_index, c.content,
              ts_rank_cd(to_tsvector('english', c.content), websearch_to_tsquery('english', $2), 32) AS score,
              ts_headline('english', c.content, websearch_to_tsquery('english', $2), ${HL}) AS highlight
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       LEFT JOIN folders f ON f.id = d.folder_id
       WHERE d.user_id = $1 AND d.status = 'ready'
         AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', $2)
       ORDER BY score DESC
       LIMIT $3`,
      [me.id, q, k]
    );
  } else {
    const [vec] = await embed([q]);
    const fn =
      mode === "semantic"
        ? "semantic_search($1, $2::vector, $4)"
        : "hybrid_search($1, $2::vector, $3, $4)";
    results = await query(
      `SELECT r.*, ts_headline('english', r.content, plainto_tsquery('english', $3), ${HL}) AS highlight
       FROM ${fn} r`,
      [me.id, toVector(vec), q, k]
    );
  }

  await query(
    "INSERT INTO query_logs (user_id, query_text, result_count, mode) VALUES ($1, $2, $3, $4)",
    [me.id, q, results.length, mode]
  );

  return ok({ mode, results, ms: Date.now() - started });
});

// Recent searches for the current user
export const GET = handle(async () => {
  const me = await requireUser();
  const recent = await query(
    `SELECT query_text, mode, result_count, created_at
     FROM query_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8`,
    [me.id]
  );
  return ok({ recent });
});
