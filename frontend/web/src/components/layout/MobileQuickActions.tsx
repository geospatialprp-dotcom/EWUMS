import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  ButtonBase,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Typography,
} from '@mui/material';
import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { isContractorUser, isSuperAdmin } from '../../utils/operationalAccess';

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
  tone: string;
};

const FIELD_ACTIONS: QuickAction[] = [
  {
    id: 'progress',
    label: 'Add Progress',
    icon: <TrendingUpOutlinedIcon />,
    path: '/projects',
    permission: 'project:read',
    tone: '#0F4C81',
  },
  {
    id: 'visit',
    label: 'Site Visit',
    icon: <TravelExploreOutlinedIcon />,
    path: '/projects',
    permission: 'project:read',
    tone: '#0F766E',
  },
  {
    id: 'photo',
    label: 'Upload Photo',
    icon: <AddAPhotoOutlinedIcon />,
    path: '/projects',
    permission: 'project:read',
    tone: '#0369A1',
  },
  {
    id: 'measure',
    label: 'Add Measurement',
    icon: <StraightenOutlinedIcon />,
    path: '/projects',
    permission: 'project:read',
    tone: '#B45309',
  },
  {
    id: 'project',
    label: 'View Project',
    icon: <AssignmentOutlinedIcon />,
    path: '/projects',
    permission: 'project:read',
    tone: '#334155',
  },
  {
    id: 'map',
    label: 'View Map',
    icon: <MapOutlinedIcon />,
    path: '/map',
    permission: 'project:read',
    tone: '#047857',
  },
  {
    id: 'issue',
    label: 'Report Issue',
    icon: <ReportProblemOutlinedIcon />,
    path: '/complaints',
    permission: 'om:read',
    tone: '#B91C1C',
  },
];

/**
 * Touch-first field quick actions for mobile home.
 * Routes to existing modules only — no new APIs or workflows.
 */
export function MobileQuickActionStrip({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const { isMobile } = useBreakpoint();

  if (!isMobile) return null;

  const actions = FIELD_ACTIONS.filter((a) => {
    if (a.permission && !hasPermission(a.permission)) return false;
    if (isContractorUser(user?.roles) && a.path === '/complaints') return false;
    if (isSuperAdmin(user?.roles) && (a.path === '/complaints' || a.path === '/projects')) return false;
    return true;
  });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: compact ? 'repeat(4, 1fr)' : 'repeat(2, minmax(0, 1fr))',
        gap: 1.25,
        mb: 2.5,
      }}
    >
      {actions.map((action) => (
        <ButtonBase
          key={action.id}
          onClick={() => navigate(action.path)}
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1.25,
            minHeight: 56,
            px: 1.5,
            py: 1.25,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
            textAlign: 'left',
            transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
            '&:active': {
              bgcolor: 'grey.50',
              boxShadow: 'none',
            },
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${action.tone}14`,
              color: action.tone,
              '& .MuiSvgIcon-root': { fontSize: 22 },
            }}
          >
            {action.icon}
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.primary"
            sx={{ lineHeight: 1.25, fontSize: '0.75rem' }}
          >
            {action.label}
          </Typography>
        </ButtonBase>
      ))}
    </Box>
  );
}

export default function MobileFieldSpeedDial() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);

  const onDashboard =
    location.pathname === '/' ||
    location.pathname.startsWith('/dashboard');

  if (!isMobile || onDashboard) return null;

  const actions = FIELD_ACTIONS.filter((a) => {
    if (a.permission && !hasPermission(a.permission)) return false;
    if (isContractorUser(user?.roles) && a.path === '/complaints') return false;
    if (isSuperAdmin(user?.roles) && (a.path === '/complaints' || a.path === '/projects')) return false;
    return true;
  });

  return (
    <SpeedDial
      ariaLabel="Field quick actions"
      icon={<SpeedDialIcon />}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      FabProps={{ color: 'primary', size: 'medium' }}
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed',
        bottom: { xs: 80, md: 24 },
        right: 16,
        zIndex: (theme) => theme.zIndex.speedDial,
      }}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.id}
          icon={action.icon}
          tooltipTitle={action.label}
          tooltipOpen
          onClick={() => {
            setOpen(false);
            navigate(action.path);
          }}
        />
      ))}
    </SpeedDial>
  );
}

/** Optional compact FAB if SpeedDial is too heavy on a page. */
export function MobileQuickFab({ to = '/projects' }: { to?: string }) {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  if (!isMobile) return null;
  return (
    <Fab
      color="primary"
      aria-label="Quick action"
      onClick={() => navigate(to)}
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: (theme) => theme.zIndex.speedDial,
      }}
    >
      <TrendingUpOutlinedIcon />
    </Fab>
  );
}
