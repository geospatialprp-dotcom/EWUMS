import {
  Alert, Box, Chip, List, ListItem, ListItemText, Typography,
} from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

export type LaAiAlert = {
  id: string;
  type: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  laCaseId?: string;
  caseNo?: string;
  caseTitle?: string;
  laParcelId?: string;
  clearanceId?: string;
  khasraNo?: string;
  village?: string;
  suggestedAction?: string;
  detectedAt?: string;
};

export type LaAiAlertsBundle = {
  total?: number;
  critical?: number;
  warning?: number;
  info?: number;
  alerts?: LaAiAlert[];
};

function severityIcon(severity: LaAiAlert['severity']) {
  if (severity === 'critical') return <ErrorOutlineOutlinedIcon fontSize="small" color="error" />;
  if (severity === 'warning') return <WarningAmberOutlinedIcon fontSize="small" color="warning" />;
  return <InfoOutlinedIcon fontSize="small" color="info" />;
}

function severityColor(severity: LaAiAlert['severity']): 'error' | 'warning' | 'info' | 'default' {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  if (severity === 'info') return 'info';
  return 'default';
}

export default function LaAiAlertsPanel({
  data,
  showCaseRef = false,
}: {
  data?: LaAiAlertsBundle | null;
  showCaseRef?: boolean;
}) {
  const alerts = data?.alerts ?? [];
  const total = data?.total ?? alerts.length;

  if (!alerts.length) {
    return (
      <Alert severity="success" icon={<AutoAwesomeOutlinedIcon />}>
        No AI alerts — pipeline, parcels, clearances, and ownership records look clear.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
        <Chip size="small" label={`${total} alert${total === 1 ? '' : 's'}`} color="default" />
        {(data?.critical ?? 0) > 0 && (
          <Chip size="small" label={`${data!.critical} critical`} color="error" variant="outlined" />
        )}
        {(data?.warning ?? 0) > 0 && (
          <Chip size="small" label={`${data!.warning} warning`} color="warning" variant="outlined" />
        )}
        {(data?.info ?? 0) > 0 && (
          <Chip size="small" label={`${data!.info} info`} color="info" variant="outlined" />
        )}
      </Box>

      <List dense disablePadding>
        {alerts.map((alert) => (
          <ListItem
            key={alert.id}
            alignItems="flex-start"
            sx={{
              mb: 1,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alert.severity === 'critical' ? 'error.50' : alert.severity === 'warning' ? 'warning.50' : 'background.paper',
            }}
          >
            <Box mt={0.5} mr={1}>{severityIcon(alert.severity)}</Box>
            <ListItemText
              primary={(
                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="subtitle2" fontWeight={700}>{alert.label}</Typography>
                  <Chip size="small" label={alert.severity} color={severityColor(alert.severity)} />
                  {showCaseRef && alert.caseNo && (
                    <Chip size="small" variant="outlined" label={alert.caseNo} />
                  )}
                </Box>
              )}
              secondary={(
                <Box mt={0.5}>
                  <Typography variant="body2" color="text.primary">{alert.message}</Typography>
                  {(alert.khasraNo || alert.village) && (
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                      Parcel: {alert.khasraNo ?? '—'} · {alert.village ?? '—'}
                    </Typography>
                  )}
                  {alert.suggestedAction && (
                    <Typography variant="caption" color="primary.main" display="block" mt={0.5}>
                      → {alert.suggestedAction}
                    </Typography>
                  )}
                </Box>
              )}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
