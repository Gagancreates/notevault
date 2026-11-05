import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Dashboard numbers for the current user (aggregate functions + stored function)
export const GET = handle(async () => {
  const me = await requireUser();
  const [totals] = await query(
    `SELECT COUNT(DISTINCT d.id)::int AS documents,
            COUNT(c.id)::int          AS chunks,
            (SELECT COUNT(*)::int FROM folders WHERE user_id = $1)    AS folders,
            (SELECT COUNT(*)::int FROM query_logs WHERE user_id = $1) AS searches
     FROM documents d LEFT JOIN chunks c ON c.document_id = d.id
     WHERE d.user_id = $1`,
    [me.id]
  );
  const byFolder = await query("SELECT folder, doc_count::int FROM get_folder_summary($1)", [me.id]);
  return ok({ totals, byFolder });
});
