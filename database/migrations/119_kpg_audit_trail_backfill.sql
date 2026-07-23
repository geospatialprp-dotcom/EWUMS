-- Migration 119: Backfill Karanprayag (DIV-KPG) demo activity into audit_logs
-- Admin (header = Karanprayag) and EE panel share the same Audit Trail rows.

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS location VARCHAR(255);

DO $$
DECLARE
  v_tenant UUID := 'a0000000-0000-0000-0000-000000000001';
  v_div    UUID := 'd1000000-0000-0000-0000-000000000010';
  v_ee     UUID;
  v_je     UUID;
  v_ae     UUID;
BEGIN
  SELECT id INTO v_ee FROM users WHERE tenant_id = v_tenant AND email = 'ee.kpg@egip.local' LIMIT 1;
  SELECT id INTO v_je FROM users WHERE tenant_id = v_tenant AND email = 'je.kpg@egip.local' LIMIT 1;
  SELECT id INTO v_ae FROM users WHERE tenant_id = v_tenant AND email = 'ae.kpg@egip.local' LIMIT 1;

  IF v_ee IS NULL AND v_je IS NULL THEN
    RAISE NOTICE '119: No KPG EE/JE users found — skip audit backfill';
    RETURN;
  END IF;

  UPDATE users SET division_id = v_div
  WHERE id IN (v_ee, v_je, v_ae) AND id IS NOT NULL
    AND (division_id IS NULL OR division_id <> v_div);

  INSERT INTO user_division_assignments (user_id, division_id)
  SELECT u.id, v_div FROM users u WHERE u.id IN (v_ee, v_je, v_ae) AND u.id IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

  INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
  SELECT v_tenant, x.actor_id, x.action, x.resource_type, NULL, x.details, NOW() - x.age
  FROM (
    SELECT COALESCE(v_ee, v_je) AS actor_id, 'auth.login'::text AS action, 'user'::text AS resource_type,
      jsonb_build_object('email', 'ee.kpg@egip.local', 'divisionId', v_div, 'divisionName', 'Karanprayag Division') AS details,
      INTERVAL '3 hours' AS age
    UNION ALL
    SELECT COALESCE(v_je, v_ee), 'auth.login', 'user',
      jsonb_build_object('email', 'je.kpg@egip.local', 'divisionId', v_div, 'divisionName', 'Karanprayag Division'),
      INTERVAL '5 hours'
    UNION ALL
    SELECT COALESCE(v_ee, v_je), 'dashboard.view', 'dashboard',
      jsonb_build_object('page', 'division', 'divisionId', v_div, 'divisionName', 'Karanprayag Division'),
      INTERVAL '2 hours'
    UNION ALL
    SELECT COALESCE(v_je, v_ee), 'complaint.list', 'om_complaint',
      jsonb_build_object('scope', 'division', 'divisionId', v_div, 'divisionName', 'Karanprayag Division'),
      INTERVAL '4 hours'
  ) x
  WHERE x.actor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM audit_logs l
      WHERE l.tenant_id = v_tenant
        AND l.user_id = x.actor_id
        AND l.action = x.action
        AND l.details->>'divisionId' = v_div::text
        AND l.created_at > NOW() - INTERVAL '2 days'
    );

  IF to_regclass('public.om_consumer_complaints') IS NOT NULL THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
    SELECT
      c.tenant_id,
      COALESCE(c.assigned_to, c.reported_by, v_je, v_ee),
      CASE
        WHEN c.status IN ('resolved', 'closed') THEN 'complaint.resolve'
        WHEN c.assigned_to IS NOT NULL THEN 'complaint.assign'
        ELSE 'complaint.create'
      END,
      'om_complaint',
      c.id,
      jsonb_build_object(
        'complaintNo', c.complaint_no,
        'type', c.complaint_type,
        'status', c.status,
        'village', c.village,
        'divisionId', v_div,
        'divisionName', 'Karanprayag Division',
        'projectId', c.project_id
      ),
      COALESCE(c.created_at, NOW() - INTERVAL '1 day')
    FROM om_consumer_complaints c
    LEFT JOIN projects p ON p.id = c.project_id
    WHERE c.tenant_id = v_tenant
      AND (
        p.division_id = v_div
        OR c.complaint_no ILIKE 'CMP-KPG-%'
        OR COALESCE(c.village, '') ILIKE '%Karanprayag%'
        OR COALESCE(c.village, '') ILIKE '%Tharali%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM audit_logs l
        WHERE l.resource_id = c.id AND l.action LIKE 'complaint.%'
      );
  END IF;

  IF to_regclass('public.om_consumers') IS NOT NULL THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
    SELECT
      c.tenant_id,
      COALESCE(v_je, v_ee),
      'consumer.create',
      'om_consumer',
      c.id,
      jsonb_build_object(
        'fhtc', c.fhtc_number,
        'consumerCode', c.consumer_code,
        'name', c.consumer_name,
        'village', c.village,
        'divisionId', v_div,
        'divisionName', 'Karanprayag Division',
        'projectId', c.project_id
      ),
      COALESCE(c.created_at, NOW() - INTERVAL '7 days')
    FROM om_consumers c
    LEFT JOIN projects p ON p.id = c.project_id
    WHERE c.tenant_id = v_tenant
      AND (
        p.division_id = v_div
        OR c.fhtc_number ILIKE '%KPG%'
        OR COALESCE(c.village, '') ILIKE '%Karanprayag%'
        OR COALESCE(c.village, '') ILIKE '%Tharali%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM audit_logs l
        WHERE l.resource_id = c.id AND l.action = 'consumer.create'
      );
  END IF;

  INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, created_at)
  SELECT
    p.tenant_id,
    COALESCE(v_ee, v_je),
    'project.view',
    'project',
    p.id,
    jsonb_build_object(
      'projectCode', p.project_code,
      'name', p.name,
      'divisionId', v_div,
      'divisionName', 'Karanprayag Division'
    ),
    COALESCE(p.created_at, NOW() - INTERVAL '1 day')
  FROM projects p
  WHERE p.tenant_id = v_tenant
    AND p.division_id = v_div
    AND COALESCE(v_ee, v_je) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM audit_logs l
      WHERE l.resource_id = p.id
        AND l.action = 'project.view'
        AND l.details->>'divisionId' = v_div::text
    );

  RAISE NOTICE '119: Karanprayag audit trail backfill complete';
END $$;
