-- Allow GIS site photos on construction_assets (resource_type was missing from CHECK).
ALTER TABLE construction_documents DROP CONSTRAINT IF EXISTS construction_documents_resource_type_check;
ALTER TABLE construction_documents ADD CONSTRAINT construction_documents_resource_type_check
  CHECK (resource_type IN (
    'dpr', 'measurement_book', 'invoice', 'ra_bill', 'work_planning', 'completion', 'construction_asset'
  ));
