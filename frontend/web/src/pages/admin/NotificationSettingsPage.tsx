import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { omApi } from '../../services/api';
import PageShell from '../../components/layout/PageShell';
import PageHeader from '../../components/layout/PageHeader';
import SurfaceCard from '../../components/layout/SurfaceCard';
import { useTranslation } from '../../context/LanguageContext';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type ChannelStatus = { configured: boolean; provider: string | null };

type NotificationConfig = {
  mode: 'live' | 'handoff';
  sms: ChannelStatus;
  whatsapp: ChannelStatus;
  email: ChannelStatus;
  events?: Record<string, boolean>;
  handoffNote?: string | null;
};

type AlertLogItem = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  recipient: string | null;
  subject: string | null;
  message: string;
  provider: string | null;
  errorReason: string | null;
  createdAt: string;
};

function ChannelCard({
  icon,
  label,
  status,
  providerLabel,
}: {
  icon: React.ReactNode;
  label: string;
  status: ChannelStatus;
  providerLabel: string;
}) {
  return (
    <SurfaceCard sx={{ flex: 1, minWidth: 200, p: 2.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: status.configured ? '#ecfdf5' : '#f8fafc',
            color: status.configured ? '#059669' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {status.configured
              ? `${providerLabel}: ${status.provider ?? '—'}`
              : providerLabel}
          </Typography>
        </Box>
      </Stack>
      <Chip
        size="small"
        label={status.configured ? 'Enabled' : 'Not configured'}
        color={status.configured ? 'success' : 'default'}
        variant={status.configured ? 'filled' : 'outlined'}
        sx={{ fontWeight: 700 }}
      />
    </SurfaceCard>
  );
}

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [log, setLog] = useState<AlertLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [configRes, logRes] = await Promise.all([
          omApi.getNotificationConfig(),
          omApi.getAlertLog(30),
        ]);
        if (!active) return;
        setConfig(configRes.data);
        setLog(logRes.data ?? []);
      } catch {
        if (active) setError(t('notificationSettings.loadError'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [t]);

  return (
    <PageShell>
      <PageHeader
        title={t('notificationSettings.title')}
        subtitle={t('notificationSettings.subtitle')}
        icon={<NotificationsActiveOutlinedIcon />}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box py={6} display="flex" justifyContent="center">
          <CircularProgress sx={{ color: '#f97316' }} />
        </Box>
      ) : (
        <>
          <SurfaceCard sx={{ mb: 3, p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  {t('notificationSettings.modeLabel')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {config?.mode === 'live'
                    ? t('notificationSettings.modeLive')
                    : t('notificationSettings.modeHandoff')}
                </Typography>
              </Box>
              <Chip
                label={config?.mode === 'live' ? 'LIVE' : 'HANDOFF'}
                color={config?.mode === 'live' ? 'success' : 'warning'}
                sx={{ fontWeight: 800 }}
              />
            </Stack>
            {config?.handoffNote && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {config.handoffNote}
              </Alert>
            )}
          </SurfaceCard>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={3}>
            <ChannelCard
              icon={<EmailOutlinedIcon />}
              label={t('notificationSettings.email')}
              status={config?.email ?? { configured: false, provider: null }}
              providerLabel={t('notificationSettings.provider')}
            />
            <ChannelCard
              icon={<SmsOutlinedIcon />}
              label={t('notificationSettings.sms')}
              status={config?.sms ?? { configured: false, provider: null }}
              providerLabel={t('notificationSettings.provider')}
            />
            <ChannelCard
              icon={<WhatsAppIcon />}
              label={t('notificationSettings.whatsapp')}
              status={config?.whatsapp ?? { configured: false, provider: null }}
              providerLabel={t('notificationSettings.provider')}
            />
          </Stack>

          <SurfaceCard sx={{ mb: 3, p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} mb={1.5}>
              {t('notificationSettings.eventsTitle')}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {[
                'complaintAssigned',
                'complaintResolved',
                'workflowPendingApproval',
                'billDueReminder',
              ].map((key) => (
                <Chip
                  key={key}
                  label={t(`notificationSettings.events.${key}`)}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
              {t('notificationSettings.envHint')}
            </Typography>
          </SurfaceCard>

          <SurfaceCard>
            <Typography variant="subtitle1" fontWeight={800} px={2} pt={2}>
              {t('notificationSettings.recentLog')}
            </Typography>
            {log.length === 0 ? (
              <Box px={2} py={4} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  {t('notificationSettings.emptyLog')}
                </Typography>
              </Box>
            ) : (
              <Table size="small" sx={dataTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('notificationSettings.log.time')}</TableCell>
                    <TableCell>{t('notificationSettings.log.event')}</TableCell>
                    <TableCell>{t('notificationSettings.log.channel')}</TableCell>
                    <TableCell>{t('notificationSettings.log.recipient')}</TableCell>
                    <TableCell>{t('notificationSettings.log.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {log.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        {new Date(row.createdAt).toLocaleString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>{row.eventType.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{row.channel}</TableCell>
                      <TableCell>{row.recipient ?? '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status}
                          color={row.status === 'sent' ? 'success' : row.status === 'handoff' ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SurfaceCard>
        </>
      )}
    </PageShell>
  );
}
