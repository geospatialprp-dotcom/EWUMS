-- OPTIONAL DEMO SEED — skip if Tharali project (PRJ-TPPWSS-2026-27) is absent.
-- Do not run on production after cleanup (see 091_cleanup_demo_kpg_data.sql).
-- Robust Karanprayag (DIV-KPG) demo complaints — idempotent upsert for production.
-- Resolves Tharali scheme dynamically; fixes 087 rows stuck with wrong/missing project_id.



ALTER TABLE om_consumer_complaints

  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),

  ADD COLUMN IF NOT EXISTS om_consumer_id UUID REFERENCES om_consumers(id),

  ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id),

  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',

  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS response_time_mins INT,

  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();



DO $$

DECLARE

  v_tenant       UUID := 'a0000000-0000-0000-0000-000000000001';

  v_div_kpg      UUID := 'd1000000-0000-0000-0000-000000000010';

  v_je_kpg       UUID := 'c0000000-0000-0000-0000-000000000011';

  v_project      UUID;

  v_consumer     UUID;

BEGIN

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
    RAISE NOTICE '088: Tharali project (PRJ-TPPWSS-2026-27) not found — skipping KPG demo complaints seed';
    RETURN;
  END IF;



  UPDATE projects

  SET division_id = v_div_kpg

  WHERE tenant_id = v_tenant

    AND id = v_project;



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

    VALUES (

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

      'Demo account for Karanprayag complaints'

    )

    ON CONFLICT (tenant_id, fhtc_number) DO UPDATE SET project_id = EXCLUDED.project_id;

    v_consumer := 'c1000000-0000-0000-0000-000000000001';

  ELSE

    UPDATE om_consumers

    SET project_id = v_project

    WHERE id = v_consumer AND tenant_id = v_tenant;

  END IF;



  INSERT INTO om_consumer_complaints (

    id, tenant_id, project_id, om_consumer_id, complaint_no, consumer_id, fhtc_number,

    mobile, village, complaint_type, channel, description, status, priority,

    assigned_to, assigned_at, response_time_mins, created_at

  )

  VALUES

  (

    'e2000000-0000-0000-0000-000000000001',

    v_tenant,

    v_project,

    v_consumer,

    'CMP-KPG-2026-00001',

    'CON-PORTAL-00001',

    'FHTC-DEMO-001',

    '9876543210',

    'Tharali',

    'no_water_supply',

    'web_portal',

    'No water since morning at Ward 3, Tharali.',

    'ticket_generated',

    'high',

    NULL, NULL, NULL,

    NOW() - INTERVAL '2 days'

  ),

  (

    'e2000000-0000-0000-0000-000000000002',

    v_tenant,

    v_project,

    NULL,

    'CMP-KPG-2026-00002',

    NULL,

    'FHTC-KPG-0042',

    '9876501234',

    'Pinder',

    'low_pressure',

    'call_centre',

    'Low pressure reported near Pinder market area.',

    'assigned',

    'medium',

    v_je_kpg,

    NOW() - INTERVAL '1 day',

    45,

    NOW() - INTERVAL '3 days'

  ),

  (

    'e2000000-0000-0000-0000-000000000003',

    v_tenant,

    v_project,

    NULL,

    'CMP-KPG-2026-00003',

    NULL,

    'FHTC-KPG-0018',

    '9876512345',

    'Karanprayag',

    'leakage',

    'whatsapp',

    'Pipeline leakage near main road — resolved and chlorinated.',

    'closed',

    'medium',

    v_je_kpg,

    NOW() - INTERVAL '5 days',

    30,

    NOW() - INTERVAL '7 days'

  )

  ON CONFLICT (tenant_id, complaint_no) DO UPDATE SET

    project_id         = EXCLUDED.project_id,

    om_consumer_id     = EXCLUDED.om_consumer_id,

    consumer_id        = EXCLUDED.consumer_id,

    fhtc_number        = EXCLUDED.fhtc_number,

    mobile             = EXCLUDED.mobile,

    village            = EXCLUDED.village,

    complaint_type     = EXCLUDED.complaint_type,

    channel            = EXCLUDED.channel,

    description        = EXCLUDED.description,

    status             = EXCLUDED.status,

    priority           = EXCLUDED.priority,

    assigned_to        = EXCLUDED.assigned_to,

    assigned_at        = EXCLUDED.assigned_at,

    response_time_mins = EXCLUDED.response_time_mins,

    updated_at         = NOW();



  UPDATE om_consumer_complaints

  SET

    resolution_notes = COALESCE(resolution_notes, 'Leak repaired; line pressure restored.'),

    resolved_at = COALESCE(resolved_at, NOW() - INTERVAL '6 days'),

    consumer_feedback = COALESCE(consumer_feedback, 'Satisfied with quick response.'),

    feedback_at = COALESCE(feedback_at, NOW() - INTERVAL '5 days'),

    closed_at = COALESCE(closed_at, NOW() - INTERVAL '5 days')

  WHERE tenant_id = v_tenant

    AND complaint_no = 'CMP-KPG-2026-00003';



  UPDATE om_consumer_complaints c

  SET project_id = v_project

  WHERE c.tenant_id = v_tenant

    AND c.complaint_no LIKE 'CMP-KPG-%'

    AND (c.project_id IS NULL OR c.project_id <> v_project);



  RAISE NOTICE 'KPG complaints seeded for Tharali project % (PRJ-TPPWSS-2026-27)', v_project;

END $$;



-- JE Karanprayag must see O&M / complaints nav (om:read minimum).

INSERT INTO role_permissions (role_id, permission_id, scope)

SELECT 'b0000000-0000-0000-0000-000000000006', p.id, 'division'

FROM permissions p

WHERE p.resource = 'om' AND p.action = 'read'

ON CONFLICT (role_id, permission_id) DO NOTHING;



-- Re-affirm division assignment for je.kpg (some VPS DBs only use assignment table).

INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, department, status, division_id)

VALUES (

  'c0000000-0000-0000-0000-000000000011',

  'a0000000-0000-0000-0000-000000000001',

  'je.kpg@egip.local',

  crypt('JE@123', gen_salt('bf')),

  'Junior', 'Engineer (KPG)', 'Karanprayag Division', 'active',

  'd1000000-0000-0000-0000-000000000010'

)

ON CONFLICT (tenant_id, email) DO UPDATE SET

  division_id = EXCLUDED.division_id,

  status = 'active';



INSERT INTO user_division_assignments (user_id, division_id)

VALUES ('c0000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000010')

ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id;

