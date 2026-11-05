-- B-tree indexes for foreign keys and common filters
CREATE INDEX IF NOT EXISTS idx_documents_user        ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder      ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document       ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_user_time  ON query_logs(user_id, created_at DESC);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON chunks
  USING GIN (to_tsvector('english', content));

-- HNSW index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
