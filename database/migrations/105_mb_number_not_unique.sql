-- MB number may repeat within a project (multiple entries for same MB book no.).
ALTER TABLE measurement_books
  DROP CONSTRAINT IF EXISTS measurement_books_project_id_mb_number_key;
