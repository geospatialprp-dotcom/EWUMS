import { Alert } from '@mui/material';
import { useEffect, useState } from 'react';

type ApiMode = 'postgresql' | 'dev-mock' | 'unknown';

/** Local dev only — warns when dev-server.js (npm run dev:mock) is on port 3000. */
export default function ApiModeBanner() {
  const [mode, setMode] = useState<ApiMode>('unknown');

  useEffect(() => {
    if (import.meta.env.PROD) return;

    let cancelled = false;
    fetch('/api/v1/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { mode?: string; engine?: string };
        if (cancelled) return;
        if (data.mode === 'dev-mock') setMode('dev-mock');
        else if (data.mode === 'postgresql' || data.engine === 'nestjs') setMode('postgresql');
        else setMode('unknown');
      })
      .catch(() => {
        if (!cancelled) setMode('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (import.meta.env.PROD || mode !== 'dev-mock') return null;

  return (
    <Alert severity="error" sx={{ borderRadius: 0, py: 0.5 }}>
      Demo mock API is running — your real PostgreSQL projects are not loaded. Stop{' '}
      <strong>dev:mock</strong> and run <strong>scripts/start-dev.ps1</strong> (PostgreSQL) instead.
    </Alert>
  );
}
