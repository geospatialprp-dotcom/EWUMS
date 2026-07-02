import { ReactNode, useEffect, useState } from 'react';

import {
  Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material';

import { auditApi } from '../../services/api';

import PageShell from '../../components/layout/PageShell';

import PageHeader from '../../components/layout/PageHeader';

import SurfaceCard from '../../components/layout/SurfaceCard';

import { dataTableSx } from '../../utils/pagePresentationStyles';
import { exportAuditTrailPdf } from '../../utils/pdfExport';
import AuditLocationDisplay from '../../components/audit/AuditLocationDisplay';
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
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  details: Record<string, unknown>;
  createdAt: string;
}

const STICKY_TIMESTAMP_WIDTH = 168;
const STICKY_USER_WIDTH = 220;
const AUDIT_TABLE_MIN_WIDTH = 1180;

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

const tableContainerSx = {
  display: { xs: 'none', md: 'block' },
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'visible',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
};

function formatUser(entry: AuditEntry): string {
  if (entry.userEmail) {
    return entry.userName ? `${entry.userName} (${entry.userEmail})` : entry.userEmail;
  }
  if (entry.userName) return entry.userName;
  return entry.userId ?? '—';
}

function formatDetails(details: Record<string, unknown>): string {
  const text = JSON.stringify(details);
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
        <AuditLocationDisplay entry={log} />
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
        actions={(
          <ExportPdfButton
            disabled={loading || logs.length === 0}
            onClick={() => exportAuditTrailPdf(logs, activeDivision?.name ?? null)}
          />
        )}
      />

      <SurfaceCard
        title="Activity Log"
        flush
        cardSx={{ overflow: 'visible' }}
        contentSx={{ overflow: 'visible', minWidth: 0, p: 0, '&:last-child': { pb: 0 } }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: { xs: 'none', md: 'block' },
            px: 2,
            py: 1,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#f8fafc',
          }}
        >
          Timestamp and User stay fixed while you scroll right for Location and Details.
        </Typography>
        <Stack
          spacing={1.25}
          sx={{ display: { xs: 'flex', md: 'none' }, px: 1.5, py: 1.5 }}
        >
          {logs.map((log) => (
            <AuditLogMobileCard key={log.id} log={log} actionColor={actionColor} />
          ))}
        </Stack>

        <TableContainer sx={tableContainerSx}>
            <Table
              size="small"
              stickyHeader
              sx={auditTableSx}
            >
              <TableHead>
                <TableRow>
                  <TableCell className="audit-sticky audit-sticky--time" sx={{ whiteSpace: 'nowrap' }}>
                    Timestamp
                  </TableCell>
                  <TableCell className="audit-sticky audit-sticky--user">User</TableCell>
                  <TableCell sx={{ minWidth: 128 }}>Action</TableCell>
                  <TableCell sx={{ minWidth: 96 }}>Resource</TableCell>
                  <TableCell sx={{ minWidth: 132 }}>IP Address</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>Location</TableCell>
                  <TableCell sx={{ minWidth: 220 }}>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const detailsText = formatDetails(log.details);
                  const detailsPreview = detailsText.length > 80 ? `${detailsText.slice(0, 80)}…` : detailsText;

                  return (
                    <TableRow key={log.id} hover>
                      <TableCell className="audit-sticky audit-sticky--time" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="audit-sticky audit-sticky--user">
                        <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
                          {formatUser(log)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 128 }}>
                        <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 96 }}>{log.resourceType ?? '—'}</TableCell>
                      <TableCell sx={{ minWidth: 132 }}>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {log.ipAddress ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }}>
                        <AuditLocationDisplay entry={log} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 220, maxWidth: 320 }}>
                        <Tooltip
                          title={
                            <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {detailsText}
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
                              cursor: detailsText.length > 80 ? 'help' : 'default',
                              fontFamily: 'monospace',
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
