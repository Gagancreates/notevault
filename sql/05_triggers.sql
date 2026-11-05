-- 1. Keep documents.chunk_count and documents.status in sync with their chunks
CREATE OR REPLACE FUNCTION refresh_document_status() RETURNS TRIGGER AS $$
BEGIN
  UPDATE documents d
  SET chunk_count = (SELECT COUNT(*) FROM chunks WHERE document_id = NEW.document_id),
      status = CASE WHEN NOT EXISTS (
                 SELECT 1 FROM chunks
                 WHERE document_id = NEW.document_id AND embedding IS NULL)
               THEN 'ready' ELSE 'pending' END
  WHERE d.id = NEW.document_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunk_status ON chunks;
CREATE TRIGGER trg_chunk_status
AFTER INSERT OR UPDATE OF embedding ON chunks
FOR EACH ROW EXECUTE FUNCTION refresh_document_status();

-- 2. Normalise e-mail addresses before they are stored (lower-case, trimmed)
CREATE OR REPLACE FUNCTION normalize_user_email() RETURNS TRIGGER AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_email ON users;
CREATE TRIGGER trg_normalize_email
BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW EXECUTE FUNCTION normalize_user_email();

-- 3. Cross-row integrity a foreign key cannot express:
--    a document may only be filed in a folder owned by the same user
CREATE OR REPLACE FUNCTION check_folder_owner() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM folders WHERE id = NEW.folder_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Folder % does not belong to the document owner', NEW.folder_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_folder_owner ON documents;
CREATE TRIGGER trg_folder_owner
BEFORE INSERT OR UPDATE OF folder_id, user_id ON documents
FOR EACH ROW EXECUTE FUNCTION check_folder_owner();
