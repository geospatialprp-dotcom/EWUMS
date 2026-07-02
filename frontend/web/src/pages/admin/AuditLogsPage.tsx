import { ReactNode, useEffect, useState } from 'react';

import {
  Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography, Alert,
} from '@mui/material';

import { auditApi } from '../../services/api';

import PageShell from '../../components/layout/PageShell';

import PageHeader from '../../components/layout/PageHeader';

import { dataTableSx } from '../../utils/pagePresentationStyles';
import { exportAuditTrailPdf } from '../../utils/pdfExport';
import { AuditLocationDisplay } from '../../components/audit/AuditLocationDisplay';
import { AdminTableShell, adminTableContainerSx } from '../../components/admin/AdminTableShell';
import { useDivisionScope, useDivisionScopeKey } from '../../context/DivisionContext';
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
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  details: Record<string, unknown>;
  createdAt: string;
}

const STICKY_TIMESTAMP_WIDTH = 168;
const STICKY_USER_WIDTH = 200;
const AUDIT_TABLE_MIN_WIDTH = 1160;

const auditTableSx = {
  ...dataTableSx(),
  minWidth: AUDIT_TABLE_MIN_WIDTH,
  width: 'max-content',
  border: 'none',
  isolation: 'isolate',
  '& .MuiTableHead-root .MuiTableCell-root.audit-sticky': {
    position: 'sticky',
    top: 0,
    zIndex: 4,
    bgcolor: '#e2e8f0',
    backgroundClip: 'padding-box',
    boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.18)',
  },
  '& .MuiTableHead-root .MuiTableCell-root.audit-sticky--time': {
    left: 0,
    zIndex: 5,
    minWidth: STICKY_TIMESTAMP_WIDTH,
    maxWidth: STICKY_TIMESTAMP_WIDTH,
  },
  '& .MuiTableHead-root .MuiTableCell-root.audit-sticky--user': {
    left: STICKY_TIMESTAMP_WIDTH,
    minWidth: STICKY_USER_WIDTH,
    maxWidth: STICKY_USER_WIDTH,
  },
  '& .MuiTableBody-root .MuiTableCell-root.audit-sticky': {
    position: 'sticky',
    zIndex: 2,
    backgroundClip: 'padding-box',
    boxShadow: '4px 0 10px -4px rgba(15, 23, 42, 0.12)',
  },
  '& .MuiTableBody-root .MuiTableCell-root.audit-sticky--time': {
    left: 0,
    zIndex: 3,
    minWidth: STICKY_TIMESTAMP_WIDTH,
    maxWidth: STICKY_TIMESTAMP_WIDTH,
  },
  '& .MuiTableBody-root .MuiTableCell-root.audit-sticky--user': {
    left: STICKY_TIMESTAMP_WIDTH,
    minWidth: STICKY_USER_WIDTH,
    maxWidth: STICKY_USER_WIDTH,
  },
  '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(odd) .audit-sticky': {
    bgcolor: '#ffffff',
  },
  '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even) .audit-sticky': {
    bgcolor: '#f8fafc',
  },
  '& .MuiTableBody-root .MuiTableRow-root:hover .audit-sticky': {
    bgcolor: '#eff6ff',
  },
};

function formatDetails(details: Record<string, unknown>): string {
  const text = JSON.stringify(details);
  return text === '{}' ? '—' : text;
}

function formatActionLabel(action: string): string {
  return action
    .replace(/\./g, ' · ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionColor(action: string): 'error' | 'success' | 'info' | 'default' {
  if (action.includes('delete') || action.includes('reject') || action.includes('deactivate')) return 'error';
  if (action.includes('create') || action.includes('approve')) return 'success';
  if (action.includes('login')) return 'info';
  return 'default';
}

function AuditUserCell({ log }: { log: AuditEntry }) {
  return (
    <Stack spacing={0.2}>
      <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
        {log.userName ?? '—'}
      </Typography>
      {log.userEmail ? (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
          {log.userEmail}
        </Typography>
      ) : null}
    </Stack>
  );
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

function AuditLogMobileCard({ log }: { log: AuditEntry }) {
  const detailsText = formatDetails(log.details);

  return (
    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5, bgcolor: '#fff' }}>
      <AuditField label="Timestamp">
        <Typography variant="body2">{new Date(log.createdAt).toLocaleString()}</Typography>
      </AuditField>
      <AuditField label="User">
        <AuditUserCell log={log} />
      </AuditField>
      <AuditField label="Action">
        <Chip label={formatActionLabel(log.action)} size="small" color={actionColor(log.action)} />
      </AuditField>
      <AuditField label="Resource">
        <Typography variant="body2">{log.resourceType ?? '—'}</Typography>
      </AuditField>
      <AuditField label="IP Address">
        <Typography variant="body2" fontFamily="monospace">{log.ipAddress ?? '—'}</Typography>
      </AuditField>
      <AuditField label="Location">
        <AuditLocationDisplay entry={log} variant="compact" />
      </AuditField>
      <AuditField label="Details">
        <Typography variant="caption" sx={{ wordBreak: 'break-word', fontFamily: 'monospace', display: 'block' }}>
          {detailsText}
        </Typography>
      </AuditField>
    </Box>
  );
}

export default function AuditLogsPage() {
  const { activeDivision } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [divisionScope, setDivisionScope] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    auditApi.logs(200)
      .then((r) => {
        setLogs(r.data.logs);
        setDivisionScope(r.data.divisionScope ?? activeDivision?.name ?? null);
      })
      .catch(() => setLoadError('Failed to load audit trail. Rebuild API on VPS if this persists after refresh.'))
      .finally(() => setLoading(false));
  }, [divisionScopeKey, activeDivision?.name]);

  return (
    <PageShell loading={loading} loadingLabel="Loading audit trail…">
      <PageHeader
        eyebrow="Compliance"
        title="Audit Trail"
        accent="slate"
        actions={(
          <ExportPdfButton
            disabled={loading || logs.length === 0}
            onClick={() => exportAuditTrailPdf(logs, divisionScope ?? activeDivision?.name ?? null)}
          />
        )}
      />

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      <AdminTableShell
        title="Activity Log"
        count={logs.length}
        divisionScope={divisionScope}
        toolbarHint="Scroll right for Location and Details. Timestamp and User columns stay fixed."
        emptyLabel="No audit activity recorded for this division scope."
      >
        <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' }, px: 1.5, py: 1.5 }}>
          {logs.map((log) => (
            <AuditLogMobileCard key={log.id} log={log} />
          ))}
        </Stack>

        <TableContainer sx={{ ...adminTableContainerSx, display: { xs: 'none', md: 'block' } }}>
          <Table size="small" stickyHeader sx={auditTableSx}>
            <TableHead>
              <TableRow>
                <TableCell className="audit-sticky audit-sticky--time">Timestamp</TableCell>
                <TableCell className="audit-sticky audit-sticky--user">User</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Action</TableCell>
                <TableCell sx={{ minWidth: 88 }}>Resource</TableCell>
                <TableCell sx={{ minWidth: 128 }}>IP Address</TableCell>
                <TableCell sx={{ minWidth: 280 }}>Location</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => {
                const detailsText = formatDetails(log.details);
                const detailsPreview = detailsText.length > 72 ? `${detailsText.slice(0, 72)}…` : detailsText;

                return (
                  <TableRow key={log.id} hover>
                    <TableCell className="audit-sticky audit-sticky--time" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <Typography variant="body2" fontSize="0.8125rem">
                        {new Date(log.createdAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell className="audit-sticky audit-sticky--user" sx={{ verticalAlign: 'top' }}>
                      <AuditUserCell log={log} />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Chip
                        label={formatActionLabel(log.action)}
                        size="small"
                        color={actionColor(log.action)}
                        sx={{ fontWeight: 600, maxWidth: 140 }}
                      />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Chip
                        label={log.resourceType ?? '—'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600, bgcolor: '#fff' }}
                      />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.78rem">
                        {log.ipAddress ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <AuditLocationDisplay entry={log} variant="compact" />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', maxWidth: 280 }}>
                      <Tooltip
                        title={(
                          <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {detailsText}
                          </Typography>
                        )}
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
                            cursor: detailsText.length > 72 ? 'help' : 'default',
                            fontFamily: 'monospace',
                            color: '#475569',
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
      </AdminTableShell>
    </PageShell>
  );
}
