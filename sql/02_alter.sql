-- ALTER: columns added after the initial design (report section 5.2)

ALTER TABLE documents  ADD COLUMN IF NOT EXISTS chunk_count  INT NOT NULL DEFAULT 0;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS result_count INT CHECK (result_count >= 0);
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'semantic';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'query_logs_mode_check') THEN
    ALTER TABLE query_logs ADD CONSTRAINT query_logs_mode_check
      CHECK (mode IN ('semantic','keyword','hybrid'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'query_logs_text_check') THEN
    ALTER TABLE query_logs ADD CONSTRAINT query_logs_text_check
      CHECK (length(trim(query_text)) BETWEEN 1 AND 500);
  END IF;
END $$;
