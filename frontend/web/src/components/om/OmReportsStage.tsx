import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControl, Grid, InputLabel, LinearProgress,
  List, ListItemButton, ListItemText, MenuItem, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import ReportExportButtons from './ReportExportButtons';
import { OM_REPORT_GROUPS, OM_REPORT_TYPES, flattenRow } from '../../constants/omReports';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type ProjectOption = { id: string; name: string; projectCode: string };

type ReportResult = {
  title?: string;
  reportType?: string;
  generatedAt?: string;
  period?: { from: string; to: string };
  projectCode?: string;
  projectName?: string;
  summary?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  serviceRequests?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
  inspections?: Array<Record<string, unknown>>;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function OmReportsStage() {
  const canViewAll = useCanViewAllDivisions();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [selectedType, setSelectedType] = useState(OM_REPORT_TYPES[0].type);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planYear, setPlanYear] = useState(String(new Date().getFullYear()));
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [report, setReport] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredTypes = useMemo(
    () => (groupFilter === 'all' ? OM_REPORT_TYPES : OM_REPORT_TYPES.filter((r) => r.group === groupFilter)),
    [groupFilter],
  );

  const tableRows = report?.rows ?? [];
  const tableColumns = useMemo(() => {
    if (!tableRows.length) return [];
    return Object.keys(flattenRow(tableRows[0] as Record<string, unknown>)).slice(0, 8);
  }, [tableRows]);

  const generate = useCallback(() => {
    setBusy(true);
    setError('');
    omApi.generateReport(selectedType, {
      projectId: selectedProject?.id,
      projectCode: selectedProject?.projectCode,
      from: fromDate,
      to: toDate,
      planYear: selectedType === 'annual_om_plan' ? Number(planYear) : undefined,
    })
      .then((res) => setReport(res.data ?? null))
      .catch((err) => setError(getApiError(err, 'Failed to generate report')))
      .finally(() => setBusy(false));
  }, [selectedType, selectedProject, fromDate, toDate, planYear]);

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = (res.data ?? []) as ProjectOption[];
        setProjects(list);
        if (list.length && !selectedProject) setSelectedProject(list[0]);
      })
      .catch(() => setError('Failed to load projects'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportRecord = report as Record<string, unknown> | null;
  const exportBaseName = `${report?.reportType ?? 'om-report'}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <SurfaceCard title="Report Catalogue">
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <MenuItem value="all">All categories</MenuItem>
                {OM_REPORT_GROUPS.map((g) => (
                  <MenuItem key={g.key} value={g.key}>{g.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <List dense sx={{ maxHeight: 420, overflow: 'auto' }}>
              {filteredTypes.map((r) => (
                <ListItemButton
                  key={r.type}
                  selected={selectedType === r.type}
                  onClick={() => setSelectedType(r.type)}
                >
                  <ListItemText
                    primary={r.label}
                    secondary={OM_REPORT_GROUPS.find((g) => g.key === r.group)?.label}
                  />
                </ListItemButton>
              ))}
            </List>
          </SurfaceCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <SurfaceCard
            header={(
              <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <DescriptionOutlinedIcon color="primary" fontSize="small" />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                    {OM_REPORT_TYPES.find((r) => r.type === selectedType)?.label}
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button size="small" variant="contained" onClick={generate} disabled={busy}>Generate</Button>
                  {reportRecord && (
                    <ReportExportButtons
                      report={reportRecord}
                      baseName={exportBaseName}
                      title={report.title}
                    />
                  )}
                </Box>
              </Box>
            )}
          >
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Scheme / Project</InputLabel>
                  <Select
                    label="Scheme / Project"
                    value={selectedProject?.id ?? ''}
                    onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) ?? null)}
                  >
                    {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                    {projects.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="From" type="date" InputLabelProps={{ shrink: true }}
                  value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="To" type="date" InputLabelProps={{ shrink: true }}
                  value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Grid>
              {selectedType === 'annual_om_plan' && (
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth size="small" label="Plan Year" type="number"
                    value={planYear} onChange={(e) => setPlanYear(e.target.value)} />
                </Grid>
              )}
            </Grid>

            {busy && <LinearProgress sx={{ mb: 2 }} />}

            {!report && !busy && (
              <Typography variant="body2" color="text.secondary" py={4} textAlign="center">
                Select a report type and click Generate to preview output.
              </Typography>
            )}

            {report && (
              <>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {report.projectCode && <Chip size="small" label={report.projectCode} />}
                  {report.period && (
                    <Chip size="small" variant="outlined" label={`${report.period.from} → ${report.period.to}`} />
                  )}
                  {report.generatedAt && (
                    <Chip size="small" variant="outlined" label={new Date(report.generatedAt).toLocaleString()} />
                  )}
                </Box>

                {report.summary && (
                  <Box mb={2} display="flex" gap={1} flexWrap="wrap">
                    {Object.entries(report.summary).map(([k, v]) => (
                      <Chip key={k} size="small" label={`${k.replace(/([A-Z])/g, ' $1')}: ${String(v)}`} />
                    ))}
                  </Box>
                )}

                <TableContainer>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        {tableColumns.map((col) => (
                          <TableCell key={col}>{col.replace(/([A-Z])/g, ' $1')}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={tableColumns.length || 1} align="center">
                            <Typography variant="body2" color="text.secondary" py={2}>No rows in this report.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {tableRows.slice(0, 50).map((row, idx) => {
                        const flat = flattenRow(row as Record<string, unknown>);
                        return (
                          <TableRow key={idx}>
                            {tableColumns.map((col) => (
                              <TableCell key={col}>{flat[col] ?? '—'}</TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {tableRows.length > 50 && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    Showing first 50 of {tableRows.length} rows. Export CSV or PDF for full data.
                  </Typography>
                )}

                {report.serviceRequests && report.serviceRequests.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>Service Requests ({report.serviceRequests.length})</Typography>
                    <Typography variant="caption" color="text.secondary">Included in CSV/PDF export</Typography>
                  </Box>
                )}

                {report.alerts && report.alerts.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>SCADA Alerts ({report.alerts.length})</Typography>
                    <Typography variant="caption" color="text.secondary">Included in CSV/PDF export</Typography>
                  </Box>
                )}
              </>
            )}
          </SurfaceCard>
        </Grid>
      </Grid>
    </>
  );
}
