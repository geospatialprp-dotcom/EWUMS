-- Fix legacy sequential project codes to name-initials + FY format.

UPDATE projects
SET project_code = 'PRJ-TPPWSS-2026-27'
WHERE project_code = 'PRJ-2026-001'
   OR name ILIKE '%Tharali Pinder Paar%';

UPDATE projects
SET project_code = 'PRJ-ZAPR-2025-26'
WHERE project_code = 'PRJ-2025-001'
  AND name = 'Zone A Pipeline Rehabilitation';
