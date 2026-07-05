-- Allow duplicate MB numbers within a project (run once on VPS).
ALTER TABLE measurement_books
  DROP CONSTRAINT IF EXISTS measurement_books_project_id_mb_number_key;
