import { useEffect, useState } from 'react';
import { Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
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

      <SurfaceCard title="Activity Log" flush>
        <Table size="small" sx={dataTableSx()}>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatUser(log)}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
                </TableCell>
                <TableCell>{log.resourceType ?? '—'}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {log.ipAddress ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>{log.location ?? '—'}</TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {JSON.stringify(log.details).slice(0, 80)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SurfaceCard>
    </PageShell>
  );
}
