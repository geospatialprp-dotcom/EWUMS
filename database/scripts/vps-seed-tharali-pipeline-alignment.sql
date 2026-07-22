-- DEPRECATED — the previous script inserted a straight fake LineString (demo_seed).
-- That is NOT a real pipeline. Use the cleanup / sync script instead:
--
--   database/scripts/vps-remove-tharali-demo-pipeline.sql
--
-- From deploy/hostinger-kvm/:
--   docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
--     psql -U egip -d egip -v ON_ERROR_STOP=1 \
--     < ../../database/scripts/vps-remove-tharali-demo-pipeline.sql

\echo 'Redirecting to vps-remove-tharali-demo-pipeline.sql (removes fake demo_seed line)...'
\ir vps-remove-tharali-demo-pipeline.sql
