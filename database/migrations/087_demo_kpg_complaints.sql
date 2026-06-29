-- OPTIONAL DEMO SEED — do not run on production after cleanup (see 091_cleanup_demo_kpg_data.sql).
-- Karanprayag (DIV-KPG) demo complaints for /complaints JE dashboard.

-- Tharali Pinder Paar WSS is the division scheme; complaints must carry project_id.



DO $$

DECLARE

  v_tenant  UUID := 'a0000000-0000-0000-0000-000000000001';

  v_div_kpg UUID := 'd1000000-0000-0000-0000-000000000010';

  v_je_kpg  UUID := 'c0000000-0000-0000-0000-000000000011';

  v_project UUID;

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

    RAISE EXCEPTION 'Tharali project (PRJ-TPPWSS-2026-27) not found — create the scheme before seeding KPG complaints';

  END IF;



  UPDATE projects

  SET division_id = v_div_kpg

  WHERE tenant_id = v_tenant

    AND id = v_project;



  -- Backfill complaints missing project_id from linked consumer.

  UPDATE om_consumer_complaints c

  SET project_id = oc.project_id

  FROM om_consumers oc

  WHERE c.tenant_id = v_tenant

    AND c.project_id IS NULL

    AND c.om_consumer_id = oc.id

    AND oc.project_id IS NOT NULL;



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

    'c1000000-0000-0000-0000-000000000001',

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

  ON CONFLICT (tenant_id, complaint_no) DO NOTHING;



  UPDATE om_consumer_complaints

  SET

    resolution_notes = COALESCE(resolution_notes, 'Leak repaired; line pressure restored.'),

    resolved_at = COALESCE(resolved_at, NOW() - INTERVAL '6 days'),

    consumer_feedback = COALESCE(consumer_feedback, 'Satisfied with quick response.'),

    feedback_at = COALESCE(feedback_at, NOW() - INTERVAL '5 days'),

    closed_at = COALESCE(closed_at, NOW() - INTERVAL '5 days')

  WHERE tenant_id = v_tenant

    AND complaint_no = 'CMP-KPG-2026-00003';



  RAISE NOTICE 'KPG complaints seeded for Tharali project % (PRJ-TPPWSS-2026-27)', v_project;

END $$;

