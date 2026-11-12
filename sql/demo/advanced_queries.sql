-- Demo queries: correlated subqueries, CTEs and recursive CTEs.
-- Read-only. Run them in the Supabase SQL editor (or psql) one at a time.
-- This folder is not picked up by `npm run db:setup`, which only runs sql/*.sql.

-- ============ CORRELATED SUBQUERIES ============

-- 1. Documents with more chunks than their owner's average document
--    (the inner query reads d.user_id from the outer row)
SELECT d.title, d.chunk_count, u.name AS owner
FROM documents d
JOIN users u ON u.id = d.user_id
WHERE d.chunk_count > (
  SELECT AVG(d2.chunk_count)
  FROM documents d2
  WHERE d2.user_id = d.user_id
);

-- 2. Folders that contain no documents (correlated NOT EXISTS)
SELECT f.name AS folder, u.name AS owner
FROM folders f
JOIN users u ON u.id = f.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM documents d WHERE d.folder_id = f.id
);

-- 3. Each user's most recent search (correlated subquery in SELECT)
SELECT u.name,
       (SELECT q.query_text
        FROM query_logs q
        WHERE q.user_id = u.id
        ORDER BY q.created_at DESC
        LIMIT 1) AS last_search
FROM users u;

-- ============ CTEs ============

-- 4. Users who search more than the average user.
--    Same result as the nested query in app/api/admin/stats/route.ts,
--    but per_user is defined once and used twice.
WITH per_user AS (
  SELECT user_id, COUNT(*) AS searches
  FROM query_logs
  GROUP BY user_id
)
SELECT u.name, p.searches
FROM per_user p
JOIN users u ON u.id = p.user_id
WHERE p.searches > (SELECT AVG(searches) FROM per_user)
ORDER BY p.searches DESC;

-- 5. Searches per mode, and how many came back empty
WITH mode_stats AS (
  SELECT mode, COUNT(*) AS searches, AVG(result_count) AS avg_results
  FROM query_logs
  GROUP BY mode
),
zero_hits AS (
  SELECT mode, COUNT(*) AS empty_searches
  FROM query_logs
  WHERE result_count = 0
  GROUP BY mode
)
SELECT m.mode, m.searches, ROUND(m.avg_results, 1) AS avg_results,
       COALESCE(z.empty_searches, 0) AS empty_searches
FROM mode_stats m
LEFT JOIN zero_hits z USING (mode)
ORDER BY m.searches DESC;

-- ============ RECURSIVE CTEs ============

-- 6. Searches per day for the last 7 days, with 0 for days without searches
WITH RECURSIVE days AS (
  SELECT current_date - 6 AS day        -- anchor: six days ago
  UNION ALL
  SELECT day + 1 FROM days              -- recursive step: the next day
  WHERE day < current_date              -- stop condition
)
SELECT d.day, COUNT(q.id) AS searches
FROM days d
LEFT JOIN query_logs q ON q.created_at::date = d.day
GROUP BY d.day
ORDER BY d.day;

-- 7. Walk the largest document chunk by chunk (0 -> 1 -> 2 ...)
WITH RECURSIVE walk AS (
  SELECT c.document_id, c.chunk_index, c.content, 0 AS step
  FROM chunks c
  WHERE c.chunk_index = 0
    AND c.document_id = (SELECT id FROM documents ORDER BY chunk_count DESC LIMIT 1)
  UNION ALL
  SELECT c.document_id, c.chunk_index, c.content, w.step + 1
  FROM chunks c
  JOIN walk w ON c.document_id = w.document_id
             AND c.chunk_index = w.chunk_index + 1
  WHERE w.step < 5
)
SELECT step, chunk_index, left(content, 80) AS preview
FROM walk
ORDER BY step;
