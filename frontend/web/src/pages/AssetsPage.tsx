import { useEffect, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import axios from 'axios';
import { assetsApi } from '../services/api';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import SurfaceCard from '../components/layout/SurfaceCard';
import { dataTableSx } from '../utils/pagePresentationStyles';

interface AssetFeature {
  id: string;
  properties: {
    assetCode: string;
    name: string;
    status: string;
    healthScore: number;
    assetType: string;
    assetTypeName: string;
    lifecycleStage: string;
  };
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) return 'Your session has expired. Please sign in again.';
    if (err.response?.status === 403) return 'You do not have permission to view assets.';
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
  }
  return 'Failed to load assets.';
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetFeature[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAssets = () => {
    setLoading(true);
    setError('');
    assetsApi.list(statusFilter ? { status: statusFilter } : undefined)
      .then((res) => setAssets(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAssets(); }, [statusFilter]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Infrastructure"
        title="Asset Registry"
        accent="teal"
        actions={(
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 160, bgcolor: '#fff', borderRadius: 1 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <SurfaceCard title="Registered Assets" flush>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Table sx={dataTableSx()}>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Lifecycle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" py={2}>No assets found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.properties.assetCode}</TableCell>
                    <TableCell>{a.properties.name}</TableCell>
                    <TableCell>{a.properties.assetTypeName}</TableCell>
                    <TableCell>
                      <Chip
                        label={a.properties.status}
                        size="small"
                        color={a.properties.status === 'critical' ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell>{a.properties.healthScore}%</TableCell>
                    <TableCell>{a.properties.lifecycleStage}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </SurfaceCard>
    </PageShell>
  );
}
