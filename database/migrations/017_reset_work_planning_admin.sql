-- Reset demo work planning — Administrator fills Approvals & Document Uploads in the app
UPDATE work_planning SET
  approved_dpr_url = NULL,
  admin_approval_ref = NULL,
  technical_sanction_ref = NULL,
  boq_upload_url = NULL,
  drawing_upload_url = NULL,
  gis_alignment_approved = FALSE,
  status = 'draft',
  approved_by = NULL,
  approved_at = NULL;

-- BOQ lines come from Administrator Excel upload in the app (not pre-seeded)
DELETE FROM boq_items
WHERE project_id = 'f0000000-0000-0000-0000-000000000001';
