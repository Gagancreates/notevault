-- NoteVault schema (PostgreSQL + pgvector)
-- Idempotent: safe to run on a fresh database or one where the tables already exist.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE
                CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin','user')),
  created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id    UUID REFERENCES folders(id) ON DELETE SET NULL,
  title        VARCHAR(200) NOT NULL,
  file_type    VARCHAR(20)  NOT NULL CHECK (file_type IN ('pdf','txt','md')),
  status       VARCHAR(10)  NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ready')),
  storage_path VARCHAR(255),
  uploaded_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT  NOT NULL CHECK (chunk_index >= 0),
  content     TEXT NOT NULL,
  embedding   VECTOR(384),
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS query_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
