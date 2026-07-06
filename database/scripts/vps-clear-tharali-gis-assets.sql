-- Clear all GIS construction assets for Tharali demo (fresh re-registration).
-- Safe: only deletes construction_assets + linked site_photo documents for PRJ-TPPWSS-2026-27.
--
-- Run on VPS:
--   docker compose -f /opt/egip/deploy/hostinger-kvm/docker-compose.prod.yml \
--     --env-file /opt/egip/deploy/hostinger-kvm/.env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < /opt/egip/database/scripts/vps-clear-tharali-gis-assets.sql

DO $$
DECLARE
  v_tenant  UUID := 'a0000000-0000-0000-0000-000000000001';
  v_project UUID;
  v_docs    INT;
  v_assets  INT;
BEGIN
  SELECT id INTO v_project
  FROM projects
  WHERE tenant_id = v_tenant
    AND project_code = 'PRJ-TPPWSS-2026-27'
  LIMIT 1;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project PRJ-TPPWSS-2026-27 not found';
  END IF;

  DELETE FROM construction_documents
  WHERE tenant_id = v_tenant
    AND project_id = v_project
    AND resource_type = 'construction_asset';
  GET DIAGNOSTICS v_docs = ROW_COUNT;

  DELETE FROM construction_assets
  WHERE tenant_id = v_tenant
    AND project_id = v_project;
  GET DIAGNOSTICS v_assets = ROW_COUNT;

  UPDATE project_completion
  SET gis_mapping_pct = 0,
      updated_at = NOW()
  WHERE tenant_id = v_tenant
    AND project_id = v_project;

  RAISE NOTICE 'Cleared % GIS asset(s) and % document(s) for Tharali (PRJ-TPPWSS-2026-27)', v_assets, v_docs;
END $$;

SELECT asset_code, asset_type, name, latitude, longitude
FROM construction_assets ca
JOIN projects p ON p.id = ca.project_id
WHERE p.project_code = 'PRJ-TPPWSS-2026-27'
ORDER BY asset_code;
