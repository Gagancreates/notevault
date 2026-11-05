-- ============ VIEWS ============
-- Dropped first so column changes apply cleanly on re-runs
DROP VIEW IF EXISTS popular_queries, document_overview, user_corpus_stats;

-- Per-user corpus statistics (admin dashboard)
CREATE OR REPLACE VIEW user_corpus_stats AS
SELECT u.id AS user_id, u.name, u.email, u.role,
       COUNT(DISTINCT d.id)                                   AS documents,
       COUNT(c.id)                                            AS chunks,
       COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'ready') AS ready_documents,
       MAX(d.uploaded_at)                                     AS last_upload
FROM users u
LEFT JOIN documents d ON d.user_id = u.id
LEFT JOIN chunks c    ON c.document_id = d.id
GROUP BY u.id, u.name, u.email, u.role;

-- Documents joined with their folder name (dashboard listing)
CREATE OR REPLACE VIEW document_overview AS
SELECT d.id, d.user_id, d.title, d.file_type, d.status, d.chunk_count,
       d.uploaded_at, d.folder_id, COALESCE(f.name, 'Unfiled') AS folder_name
FROM documents d
LEFT JOIN folders f ON f.id = d.folder_id;

-- Queries searched at least twice (admin analytics: GROUP BY + HAVING)
CREATE OR REPLACE VIEW popular_queries AS
SELECT lower(trim(query_text)) AS query, COUNT(*) AS times_searched,
       ROUND(AVG(result_count), 1) AS avg_results, MAX(created_at) AS last_searched
FROM query_logs
GROUP BY lower(trim(query_text))
HAVING COUNT(*) >= 2;

-- ============ FUNCTIONS ============

-- Folder summary for one user (documents per folder, unfiled included)
CREATE OR REPLACE FUNCTION get_folder_summary(p_user UUID)
RETURNS TABLE (folder TEXT, doc_count BIGINT) AS $$
  SELECT COALESCE(f.name, 'Unfiled')::TEXT, COUNT(d.id)
  FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
  WHERE d.user_id = p_user
  GROUP BY f.name
  ORDER BY 2 DESC;
$$ LANGUAGE sql STABLE;

-- Register a user: password is hashed inside the database with bcrypt (pgcrypto)
CREATE OR REPLACE FUNCTION register_user(p_name TEXT, p_email TEXT, p_password TEXT,
                                         p_role TEXT DEFAULT 'user')
RETURNS UUID AS $$
DECLARE new_id UUID;
BEGIN
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO users (name, email, password_hash, role)
  VALUES (trim(p_name), p_email, crypt(p_password, gen_salt('bf', 10)), p_role)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Verify a login: compares against the bcrypt hash, never sees a plain-text password column
CREATE OR REPLACE FUNCTION verify_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (id UUID, name VARCHAR, email VARCHAR, role VARCHAR) AS $$
  SELECT u.id, u.name, u.email, u.role
  FROM users u
  WHERE u.email = lower(trim(p_email))
    AND u.password_hash = crypt(p_password, u.password_hash);
$$ LANGUAGE sql STABLE;

-- Semantic search: top-k chunks by cosine similarity, scoped to the user's ready documents
CREATE OR REPLACE FUNCTION semantic_search(p_user UUID, p_query VECTOR(384), p_k INT DEFAULT 8)
RETURNS TABLE (chunk_id UUID, document_id UUID, title VARCHAR, folder TEXT,
               chunk_index INT, content TEXT, score DOUBLE PRECISION) AS $$
  SELECT c.id, d.id, d.title, COALESCE(f.name, 'Unfiled')::TEXT, c.chunk_index, c.content,
         1 - (c.embedding <=> p_query) AS score
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  LEFT JOIN folders f ON f.id = d.folder_id
  WHERE d.user_id = p_user AND d.status = 'ready'
  ORDER BY c.embedding <=> p_query
  LIMIT p_k;
$$ LANGUAGE sql STABLE;

-- Hybrid search: 0.7 x vector similarity + 0.3 x normalised full-text rank
CREATE OR REPLACE FUNCTION hybrid_search(p_user UUID, p_query VECTOR(384), p_text TEXT,
                                         p_k INT DEFAULT 8)
RETURNS TABLE (chunk_id UUID, document_id UUID, title VARCHAR, folder TEXT,
               chunk_index INT, content TEXT, score DOUBLE PRECISION) AS $$
  SELECT c.id, d.id, d.title, COALESCE(f.name, 'Unfiled')::TEXT, c.chunk_index, c.content,
         0.7 * (1 - (c.embedding <=> p_query))
       + 0.3 * ts_rank_cd(to_tsvector('english', c.content),
                          plainto_tsquery('english', p_text), 32) AS score
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  LEFT JOIN folders f ON f.id = d.folder_id
  WHERE d.user_id = p_user AND d.status = 'ready'
  ORDER BY score DESC
  LIMIT p_k;
$$ LANGUAGE sql STABLE;

-- ============ STORED PROCEDURE ============

-- Move every document from one folder (NULL = Unfiled) to another, for one user, atomically
CREATE OR REPLACE PROCEDURE reassign_documents(p_user UUID, p_from UUID, p_to UUID)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_to IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM folders WHERE id = p_to AND user_id = p_user) THEN
    RAISE EXCEPTION 'Target folder does not belong to this user' USING ERRCODE = '42501';
  END IF;
  UPDATE documents
  SET folder_id = p_to
  WHERE user_id = p_user
    AND folder_id IS NOT DISTINCT FROM p_from;
END;
$$;
