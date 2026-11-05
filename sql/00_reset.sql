-- DANGER: drops every NoteVault object. Use only to start over.
DROP VIEW IF EXISTS popular_queries, document_overview, user_corpus_stats;
DROP PROCEDURE IF EXISTS reassign_documents(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS hybrid_search(UUID, VECTOR, TEXT, INT);
DROP FUNCTION IF EXISTS semantic_search(UUID, VECTOR, INT);
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS register_user(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_folder_summary(UUID);
DROP TABLE IF EXISTS query_logs, chunks, documents, folders, users CASCADE;
DROP FUNCTION IF EXISTS refresh_document_status() CASCADE;
DROP FUNCTION IF EXISTS normalize_user_email() CASCADE;
DROP FUNCTION IF EXISTS check_folder_owner() CASCADE;
