import { Alert } from '@mui/material';
import { useEffect, useState } from 'react';

type ApiMode = 'postgresql' | 'dev-mock' | 'unknown';

export default function ApiModeBanner() {
  const [mode, setMode] = useState<ApiMode>('unknown');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { mode?: string };
        if (cancelled) return;
        if (data.mode === 'postgresql') setMode('postgresql');
        else if (data.mode === 'dev-mock') setMode('dev-mock');
        else setMode('unknown');
      })
      .catch(() => {
        if (!cancelled) setMode('dev-mock');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === 'postgresql' || mode === 'unknown') return null;

  return (
    <Alert severity="error" sx={{ borderRadius: 0, py: 0.5 }}>
      Demo mock API is running — your real PostgreSQL projects are not loaded. Stop{' '}
      <strong>dev:mock</strong> and run <strong>scripts/start-dev.ps1</strong> (PostgreSQL) instead.
    </Alert>
  );
}
