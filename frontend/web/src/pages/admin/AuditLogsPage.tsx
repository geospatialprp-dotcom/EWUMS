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
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  createdAt: string;
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
              <TableCell>Action</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>User ID</TableCell>
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
                  <Chip label={log.action} size="small" color={actionColor(log.action) as 'success'} />
                </TableCell>
                <TableCell>{log.resourceType ?? '—'}</TableCell>
                <TableCell>
                  <Typography variant="caption" fontFamily="monospace">
                    {log.userId?.slice(0, 8) ?? '—'}…
                  </Typography>
                </TableCell>
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
