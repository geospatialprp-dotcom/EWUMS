import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { workflowsApi, WorkflowInboxItem } from '../../services/api';
import { useDivisionScopeKey } from '../../context/DivisionContext';
import { useTranslation } from '../../context/LanguageContext';
import { appTouchIconButtonSx } from '../../utils/appShellStyles';

const POLL_INTERVAL_MS = 60_000;
const DISPLAY_LIMIT = 12;

function formatRelativeTime(
  iso: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('commandCenter.time.justNow');
  if (mins < 60) return t('commandCenter.time.minutesAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('commandCenter.time.hoursAgo', { hrs });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatModuleLabel(resourceType: string): string {
  return resourceType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const divisionScopeKey = useDivisionScopeKey();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<WorkflowInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const open = Boolean(anchorEl);
  const count = items.length;
  const displayItems = items.slice(0, DISPLAY_LIMIT);

  const fetchInbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const res = await workflowsApi.inbox();
      setItems(res.data ?? []);
    } catch {
      setError(true);
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox(true);
  }, [divisionScopeKey, fetchInbox]);

  useEffect(() => {
    if (!open) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    fetchInbox();
    pollRef.current = setInterval(() => fetchInbox(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, fetchInbox]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleReview = (taskId: string) => {
    handleClose();
    navigate('/workflows', { state: { highlightTaskId: taskId } });
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/workflows');
  };

  return (
    <>
      <Tooltip title={t('notificationBell.title')}>
        <IconButton
          onClick={handleOpen}
          aria-label={t('common.notifications')}
          sx={{ color: '#475569', ...appTouchIconButtonSx() }}
        >
          <Badge
            badgeContent={count}
            color="error"
            overlap="circular"
            max={99}
            invisible={count === 0}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#f97316',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.65rem',
                minWidth: 18,
                height: 18,
              },
            }}
          >
            <NotificationsOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 'min(100vw - 24px, 360px)', sm: 380 },
              mt: 0.75,
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: '#0f172a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <InboxOutlinedIcon fontSize="small" sx={{ color: '#f97316' }} />
            <Typography variant="subtitle2" fontWeight={800}>
              {t('notificationBell.title')}
            </Typography>
          </Box>
          {count > 0 && (
            <Box
              sx={{
                bgcolor: '#f97316',
                color: '#fff',
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 800,
                lineHeight: 1.4,
              }}
            >
              {count}
            </Box>
          )}
        </Box>

        {loading && items.length === 0 ? (
          <Box py={4} display="flex" justifyContent="center">
            <CircularProgress size={28} sx={{ color: '#f97316' }} />
          </Box>
        ) : error && items.length === 0 ? (
          <Box px={2} py={3}>
            <Typography variant="body2" color="error.main" textAlign="center">
              {t('notificationBell.loadError')}
            </Typography>
          </Box>
        ) : count === 0 ? (
          <Box px={2} py={3.5} textAlign="center">
            <NotificationsOutlinedIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {t('notificationBell.empty')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {displayItems.map((item, index) => {
              const timeIso = item.createdAt ?? item.instance.submittedAt;
              return (
                <Box key={item.taskId}>
                  {index > 0 && <Divider />}
                  <ListItemButton
                    onClick={() => handleReview(item.taskId)}
                    sx={{
                      py: 1.25,
                      px: 2,
                      alignItems: 'flex-start',
                      minHeight: 44,
                    }}
                  >
                    <ListItemText
                      primary={item.instance.title}
                      primaryTypographyProps={{
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        color: '#0f172a',
                        noWrap: true,
                      }}
                      secondary={
                        <Box component="span" display="block" mt={0.35}>
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: '#64748b', display: 'block', lineHeight: 1.35 }}
                          >
                            {formatModuleLabel(item.instance.resourceType)}
                            {' · '}
                            {item.stepName || t('notificationBell.step')}
                          </Typography>
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}
                          >
                            {formatRelativeTime(timeIso, t)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ArrowForwardIcon fontSize="small" sx={{ color: '#f97316', mt: 0.5, flexShrink: 0 }} />
                  </ListItemButton>
                </Box>
              );
            })}
          </List>
        )}

        <Divider />
        <Box px={2} py={1.25} bgcolor="#f8fafc">
          <Button
            fullWidth
            size="small"
            onClick={handleViewAll}
            endIcon={<ArrowForwardIcon fontSize="small" />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: '#0f172a',
              justifyContent: 'center',
              py: 0.75,
              minHeight: 44,
              '&:hover': { bgcolor: '#fff', color: '#f97316' },
            }}
          >
            {t('notificationBell.viewAll')}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
