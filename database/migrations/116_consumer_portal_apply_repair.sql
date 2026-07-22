-- Ensure consumer portal OTP table and demo login row exist (safe re-run).
-- Demo consumer MUST NOT hardcode deleted seed project f0000000-...-0001 (removed by 092).
-- Attach FHTC-DEMO-001 to live Tharali (PRJ-TPPWSS-2026-27) when present; otherwise skip.

CREATE TABLE IF NOT EXISTS consumer_portal_otp_challenges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fhtc_number     VARCHAR(50) NOT NULL,
    mobile          VARCHAR(20) NOT NULL,
    otp_hash        VARCHAR(128) NOT NULL,
    purpose         VARCHAR(30) NOT NULL DEFAULT 'portal_login',
    session_id      UUID,
    attempts        SMALLINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumer_otp_lookup
    ON consumer_portal_otp_challenges(tenant_id, fhtc_number, mobile, purpose, created_at DESC);

DO $$
DECLARE
  v_tenant   UUID := 'a0000000-0000-0000-0000-000000000001';
  v_div_kpg  UUID := 'd1000000-0000-0000-0000-000000000010';
  v_project  UUID;
  v_consumer UUID;
BEGIN
  -- Prefer live Tharali scheme over deleted demo project f0000000-...-0001
  SELECT id INTO v_project
  FROM projects
  WHERE tenant_id = v_tenant
    AND (
      project_code = 'PRJ-TPPWSS-2026-27'
      OR project_code = 'PRJ-2026-001'
      OR name ILIKE '%Tharali%'
    )
  ORDER BY
    CASE project_code WHEN 'PRJ-TPPWSS-2026-27' THEN 0 WHEN 'PRJ-2026-001' THEN 1 ELSE 2 END,
    CASE WHEN division_id = v_div_kpg THEN 0 ELSE 1 END,
    CASE WHEN name ILIKE '%Tharali%' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF v_project IS NULL THEN
    RAISE NOTICE '116: Tharali project (PRJ-TPPWSS-2026-27) not found - skipping FHTC-DEMO-001 seed (OTP table OK)';
    RETURN;
  END IF;

  SELECT id INTO v_consumer
  FROM om_consumers
  WHERE tenant_id = v_tenant
    AND fhtc_number = 'FHTC-DEMO-001'
  LIMIT 1;

  IF v_consumer IS NULL THEN
    INSERT INTO om_consumers (
      id, tenant_id, project_id, consumer_code, fhtc_number, consumer_name, mobile,
      village, ward, consumer_category, connection_status, notes
    )
    SELECT
      'c1000000-0000-0000-0000-000000000001',
      v_tenant,
      v_project,
      'CON-PORTAL-00001',
      'FHTC-DEMO-001',
      'Demo Household Consumer',
      '9876543210',
      'Tharali',
      'Ward 3',
      'apl',
      'active',
      'Demo account for Online Consumer Portal'
    WHERE EXISTS (SELECT 1 FROM projects WHERE id = v_project)
    ON CONFLICT (id) DO UPDATE SET
      project_id = EXCLUDED.project_id,
      fhtc_number = EXCLUDED.fhtc_number,
      mobile = EXCLUDED.mobile,
      connection_status = EXCLUDED.connection_status,
      updated_at = NOW();
  ELSE
    UPDATE om_consumers
    SET project_id = v_project,
        mobile = COALESCE(NULLIF(mobile, ''), '9876543210'),
        consumer_name = COALESCE(NULLIF(consumer_name, ''), 'Demo Household Consumer'),
        connection_status = 'active',
        updated_at = NOW()
    WHERE id = v_consumer
      AND tenant_id = v_tenant
      AND EXISTS (SELECT 1 FROM projects WHERE id = v_project);
  END IF;

  RAISE NOTICE '116: FHTC-DEMO-001 attached to project %', v_project;
END $$;
