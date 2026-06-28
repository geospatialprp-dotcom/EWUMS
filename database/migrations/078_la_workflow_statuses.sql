-- LA workflow v2 — expanded GIS → approval → construction pipeline statuses

UPDATE la_cases SET status = 'pipeline_designed' WHERE status = 'draft';
UPDATE la_cases SET status = 'gis_trace' WHERE status = 'alignment_traced';
UPDATE la_cases SET status = 'parcel_intersect' WHERE status = 'parcels_identified';
UPDATE la_cases SET status = 'ownership_detected' WHERE status = 'survey_verified';
UPDATE la_cases SET status = 'clearances_identified' WHERE status = 'clearances_mapped';
UPDATE la_cases SET status = 'proposal_generated' WHERE status = 'proposal_prepared';
UPDATE la_cases SET status = 'approval_je' WHERE status = 'notification';
UPDATE la_cases SET status = 'award_passed' WHERE status = 'award';
UPDATE la_cases SET status = 'compensation_paid' WHERE status = 'payment';
UPDATE la_cases SET status = 'possession_taken' WHERE status = 'possession';
UPDATE la_cases SET status = 'construction_started' WHERE status = 'closed';

ALTER TABLE la_cases ALTER COLUMN status SET DEFAULT 'pipeline_designed';
