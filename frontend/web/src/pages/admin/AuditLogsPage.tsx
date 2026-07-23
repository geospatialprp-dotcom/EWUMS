import { ReactNode, useEffect, useState } from 'react';

import {
  Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material';

import { auditApi } from '../../services/api';

import PageShell from '../../components/layout/PageShell';

import PageHeader from '../../components/layout/PageHeader';

import SurfaceCard from '../../components/layout/SurfaceCard';

import { dataTableSx } from '../../utils/pagePresentationStyles';
import { exportAuditTrailPdf } from '../../utils/pdfExport';
import { useDivisionScope } from '../../context/DivisionContext';
import ExportPdfButton from '../../components/common/ExportPdfButton';

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

function formatDetails(details: Record<string, unknown> | null | undefined): string {
  if (!details || typeof details !== 'object') return '—';
  const entries = Object.entries(details).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '—';

  const preferred = ['email', 'divisionName', 'roles', 'changes', 'title', 'status', 'action', 'comments'];
  const parts: string[] = [];
  for (const key of preferred) {
    if (!(key in details) || details[key] === undefined || details[key] === null || details[key] === '') continue;
    const value = details[key];
    if (Array.isArray(value)) {
      parts.push(`${key}: ${value.join(', ')}`);
    } else if (typeof value === 'object') {
      parts.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }

  if (!parts.length) {
    return entries
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  }
  return parts.join(' · ');
}

function formatDetailsFull(details: Record<string, unknown> | null | undefined): string {
  if (!details || typeof details !== 'object') return '—';
  const text = JSON.stringify(details, null, 2);
  return text === '{}' ? '—' : text;
}

function AuditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 1.25, '&:last-child': { mb: 0 } }}>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.625rem', mb: 0.35 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function AuditLogMobileCard({ log, actionColor }: { log: AuditEntry; actionColor: (action: string) => string }) {
  const detailsText = formatDetails(log.details);
  const detailsFull = formatDetailsFull(log.details);

  return (
    <Box
      sx={{
        border: '1px solid #e2e8f0',
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: '#fff',
      }}
    >
      <AuditField label="Timestamp">
        <Typography variant="body2">{new Date(log.createdAt).toLocaleString()}</Typography>
      </AuditField>
      <AuditField label="User">
        <Typography variant="body2">{formatUser(log)}</Typography>
      </AuditField>
      <AuditField label="Action">
        <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
      </AuditField>
      <AuditField label="Resource">
        <Typography variant="body2">
          {log.resourceType ?? '—'}
          {log.resourceId ? ` · ${log.resourceId}` : ''}
        </Typography>
      </AuditField>
      <AuditField label="IP Address">
        <Typography variant="body2" fontFamily="monospace">{log.ipAddress ?? '—'}</Typography>
      </AuditField>
      <AuditField label="Location">
        <Typography variant="body2">{log.location ?? '—'}</Typography>
      </AuditField>
      <AuditField label="Details">
        <Tooltip title={detailsFull !== '—' ? detailsFull : ''} arrow enterTouchDelay={0}>
          <Typography variant="caption" sx={{ wordBreak: 'break-word', display: 'block' }}>
            {detailsText}
          </Typography>
        </Tooltip>
      </AuditField>
    </Box>
  );
}

export default function AuditLogsPage() {
  const { activeDivision, activeDivisionId, canSwitchDivision, scopeKey } = useDivisionScope();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    auditApi.logs(200)
      .then((r) => setLogs(Array.isArray(r.data) ? r.data : []))
      .catch(() => {
        setLogs([]);
        setLoadError('Failed to load audit trail. Check API permissions and try again.');
      })
      .finally(() => setLoading(false));
  }, [scopeKey]);

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
        subtitle={
          activeDivision
            ? `Showing activity for ${activeDivision.name}`
            : canSwitchDivision
              ? 'All divisions — select a division in the header to filter'
              : undefined
        }
        accent="slate"
        actions={(
          <ExportPdfButton
            disabled={loading || logs.length === 0}
            onClick={() => exportAuditTrailPdf(logs, activeDivision?.name ?? null)}
          />
        )}
      />

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>
      )}

      {canSwitchDivision && !activeDivisionId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing activity for all divisions. Select a division in the header to narrow the trail.
        </Alert>
      )}

      {canSwitchDivision && activeDivisionId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Filtered to {activeDivision?.name}. Switch the header to <strong>All divisions</strong> to see the full HQ audit trail.
        </Alert>
      )}

      <SurfaceCard
        title={activeDivision ? `Activity Log — ${activeDivision.name}` : 'Activity Log — All Divisions'}
        flush
        cardSx={{ overflow: 'visible' }}
        contentSx={{ overflow: 'visible', minWidth: 0, p: 0, '&:last-child': { pb: 0 } }}
      >
        {!loading && !loadError && logs.length === 0 && (
          <Alert severity="info" sx={{ m: 2 }}>
            {activeDivision
              ? `No division-linked activity for ${activeDivision.name} yet. Switch header to All divisions to see HQ-wide logins and actions.`
              : 'No audit activity found yet. New logins and admin actions will appear here.'}
          </Alert>
        )}

        <Stack
          spacing={1.25}
          sx={{ display: { xs: 'flex', md: 'none' }, px: 1.5, py: 1.5 }}
        >
          {logs.map((log) => (
            <AuditLogMobileCard key={log.id} log={log} actionColor={actionColor} />
          ))}
        </Stack>

        <TableContainer
            sx={{
              display: { xs: 'none', md: 'block' },
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto',
              overflowY: 'visible',
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
                width: 'max-content',
                border: 'none',
                overflow: 'visible',
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...stickyHeadColSx, minWidth: 148, whiteSpace: 'nowrap' }}>
                    Timestamp
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>User</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Action</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Resource</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>IP Address</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>Location</TableCell>
                  <TableCell sx={{ minWidth: 220 }}>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const detailsText = formatDetails(log.details);
                  const detailsFull = formatDetailsFull(log.details);
                  const detailsPreview = detailsText.length > 90 ? `${detailsText.slice(0, 90)}…` : detailsText;

                  return (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ ...stickyFirstColSx, whiteSpace: 'nowrap', minWidth: 148 }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography variant="body2">{formatUser(log)}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>{log.resourceType ?? '—'}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Typography variant="body2" fontFamily="monospace">
                          {log.ipAddress ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>{log.location ?? '—'}</TableCell>
                      <TableCell sx={{ minWidth: 220, maxWidth: 320 }}>
                        <Tooltip
                          title={
                            <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {detailsFull}
                            </Typography>
                          }
                          arrow
                          placement="top-start"
                          enterTouchDelay={0}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: detailsFull !== '—' ? 'help' : 'default',
                            }}
                          >
                            {detailsPreview}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
      </SurfaceCard>
    </PageShell>
  );
}
