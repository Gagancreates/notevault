import { query } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireAdmin();
  const [totals] = await query(
    `SELECT (SELECT COUNT(*)::int FROM users)      AS users,
            (SELECT COUNT(*)::int FROM documents)  AS documents,
            (SELECT COUNT(*)::int FROM chunks)     AS chunks,
            (SELECT COUNT(*)::int FROM query_logs) AS searches`
  );
  // View: per-user corpus stats
  const corpus = await query(
    "SELECT * FROM user_corpus_stats ORDER BY documents DESC, name"
  );
  // View: GROUP BY + HAVING (queries searched 2+ times)
  const popular = await query(
    "SELECT * FROM popular_queries ORDER BY times_searched DESC, last_searched DESC LIMIT 10"
  );
  // Subquery: users who searched more than the average user
  const power = await query(
    `SELECT u.name, u.email, COUNT(q.id)::int AS searches
     FROM users u JOIN query_logs q ON q.user_id = u.id
     GROUP BY u.id, u.name, u.email
     HAVING COUNT(q.id) > (
       SELECT AVG(cnt) FROM (SELECT COUNT(*) AS cnt FROM query_logs GROUP BY user_id) t
     )
     ORDER BY searches DESC`
  );
  // Search usage by mode with average results
  const byMode = await query(
    `SELECT mode, COUNT(*)::int AS searches, ROUND(AVG(result_count), 1)::float AS avg_results
     FROM query_logs GROUP BY mode ORDER BY searches DESC`
  );
  const recent = await query(
    `SELECT q.query_text, q.mode, q.result_count, q.created_at, u.name
     FROM query_logs q JOIN users u ON u.id = q.user_id
     ORDER BY q.created_at DESC LIMIT 12`
  );
  return ok({ totals, corpus, popular, power, byMode, recent });
});
