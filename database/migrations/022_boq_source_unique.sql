-- Allow same item_code for government and l1_contractor BOQ on the same project
ALTER TABLE boq_items DROP CONSTRAINT IF EXISTS boq_items_project_id_item_code_key;
ALTER TABLE boq_items
  ADD CONSTRAINT boq_items_project_item_source_key UNIQUE (project_id, item_code, boq_source);
