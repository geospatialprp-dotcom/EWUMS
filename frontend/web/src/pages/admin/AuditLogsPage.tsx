import { useEffect, useState } from 'react';

import {
  Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, useMediaQuery, useTheme,
} from '@mui/material';

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

function AuditLogMobileCard({ log, actionColor }: { log: AuditEntry; actionColor: (action: string) => string }) {
  return (
    <Box
      sx={{
        border: '1px solid #e2e8f0',
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: '#fff',
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
        {new Date(log.createdAt).toLocaleString()}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
        {formatUser(log)}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
        <Typography variant="caption" color="text.secondary">
          {log.resourceType ?? '—'}
        </Typography>
      </Stack>
      <Typography variant="caption" fontFamily="monospace" display="block">
        {log.ipAddress ?? '—'} · {log.location ?? '—'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {JSON.stringify(log.details).slice(0, 120)}
      </Typography>
    </Box>
  );
}

export default function AuditLogsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const tableCellSx = isMobile ? {} : stickyFirstColSx;
  const tableHeadColSx = isMobile ? {} : stickyHeadColSx;

  return (
    <PageShell loading={loading} loadingLabel="Loading audit trail…">
      <PageHeader
        eyebrow="Compliance"
        title="Audit Trail"
        accent="slate"
      />

      <SurfaceCard
        title="Activity Log"
        flush
        cardSx={{ overflow: 'visible' }}
        contentSx={{ overflow: 'visible', minWidth: 0 }}
      >
        {isMobile ? (
          <Stack spacing={1} sx={{ px: 1.5, py: 1.5 }}>
            {logs.map((log) => (
              <AuditLogMobileCard key={log.id} log={log} actionColor={actionColor} />
            ))}
          </Stack>
        ) : (
          <TableContainer
            sx={{
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              overflowY: 'visible',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              touchAction: 'pan-x pan-y',
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                ...dataTableSx(),
                minWidth: AUDIT_TABLE_MIN_WIDTH,
                width: AUDIT_TABLE_MIN_WIDTH,
                border: 'none',
                overflow: 'visible',
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...tableHeadColSx, minWidth: 148, whiteSpace: 'nowrap' }}>
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
                    <TableCell sx={{ ...tableCellSx, whiteSpace: 'nowrap', minWidth: 148 }}>
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
        )}
      </SurfaceCard>
    </PageShell>
  );
}
