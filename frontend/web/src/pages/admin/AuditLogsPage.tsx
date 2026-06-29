import { useEffect, useState } from 'react';

import { Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

import { auditApi } from '../../services/api';

import PageShell from '../../components/layout/PageShell';

import PageHeader from '../../components/layout/PageHeader';

import SurfaceCard from '../../components/layout/SurfaceCard';

import { dataTableSx } from '../../utils/pagePresentationStyles';

interface AuditEntry {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string | null;
  location: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

const AUDIT_TABLE_MIN_WIDTH = 960;

const stickyFirstColSx = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 1,
  bgcolor: 'inherit',
  backgroundClip: 'padding-box' as const,
  boxShadow: '2px 0 6px rgba(15, 23, 42, 0.06)',
};

const stickyHeadColSx = {
  ...stickyFirstColSx,
  zIndex: 3,
  bgcolor: '#e2e8f0',
};

function formatUser(entry: AuditEntry): string {
  if (entry.userEmail) {
    return entry.userName ? `${entry.userName} (${entry.userEmail})` : entry.userEmail;
  }
  if (entry.userName) return entry.userName;
  return entry.userId ?? '—';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditApi.logs(200)
      .then((r) => setLogs(r.data))
      .finally(() => setLoading(false));
  }, []);

  const actionColor = (action: string) => {
    if (action.includes('delete') || action.includes('reject')) return 'error';
    if (action.includes('create') || action.includes('approve')) return 'success';
    if (action.includes('login')) return 'info';
    return 'default';
  };

  return (
    <PageShell loading={loading} loadingLabel="Loading audit trail…">
      <PageHeader
        eyebrow="Compliance"
        title="Audit Trail"
        accent="slate"
      />

      <SurfaceCard title="Activity Log" flush contentSx={{ overflow: 'visible' }}>
        <TableContainer
          sx={{
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{
              ...dataTableSx(),
              minWidth: AUDIT_TABLE_MIN_WIDTH,
              border: 'none',
              overflow: 'visible',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...stickyHeadColSx, minWidth: 148, whiteSpace: 'nowrap' }}>
                  Timestamp
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>User</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Action</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Resource</TableCell>
                <TableCell sx={{ minWidth: 120 }}>IP Address</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Location</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ ...stickyFirstColSx, whiteSpace: 'nowrap', minWidth: 148 }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell sx={{ minWidth: 160 }}>
                    <Typography variant="body2">{formatUser(log)}</Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
                  </TableCell>
                  <TableCell sx={{ minWidth: 100 }}>{log.resourceType ?? '—'}</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Typography variant="body2" fontFamily="monospace">
                      {log.ipAddress ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 100 }}>{log.location ?? '—'}</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                      {JSON.stringify(log.details).slice(0, 80)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>
    </PageShell>
  );
}
