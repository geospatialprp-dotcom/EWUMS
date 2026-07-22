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

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
};

const FIELD_ACTIONS: QuickAction[] = [
  { id: 'progress', label: 'Add Progress', icon: <TrendingUpOutlinedIcon />, path: '/projects', permission: 'project:read' },
  { id: 'visit', label: 'Site Visit', icon: <TravelExploreOutlinedIcon />, path: '/projects', permission: 'project:read' },
  { id: 'photo', label: 'Upload Photo', icon: <AddAPhotoOutlinedIcon />, path: '/projects', permission: 'project:read' },
  { id: 'measure', label: 'Add Measurement', icon: <StraightenOutlinedIcon />, path: '/projects', permission: 'project:read' },
  { id: 'project', label: 'View Project', icon: <AssignmentOutlinedIcon />, path: '/projects', permission: 'project:read' },
  { id: 'map', label: 'View Map', icon: <MapOutlinedIcon />, path: '/map', permission: 'project:read' },
  { id: 'issue', label: 'Report Issue', icon: <ReportProblemOutlinedIcon />, path: '/complaints', permission: 'om:read' },
];

/**
 * Mobile field quick actions — SpeedDial on non-home pages;
 * horizontal action strip intended for dashboard/home cards.
 */
export function MobileQuickActionStrip({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { isMobile } = useBreakpoint();

  if (!isMobile) return null;

  const actions = FIELD_ACTIONS.filter((a) => !a.permission || hasPermission(a.permission));

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: compact ? 'repeat(4, 1fr)' : 'repeat(2, minmax(0, 1fr))',
        gap: 1,
        mb: 2,
      }}
    >
      {actions.slice(0, compact ? 4 : 6).map((action) => (
        <ButtonBase
          key={action.id}
          onClick={() => navigate(action.path)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            minHeight: compact ? 72 : 84,
            px: 1,
            py: 1.25,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: 1,
            textAlign: 'center',
            '&:active': { bgcolor: 'grey.50' },
          }}
        >
          <Box sx={{ color: 'primary.main', display: 'flex', '& .MuiSvgIcon-root': { fontSize: 26 } }}>
            {action.icon}
          </Box>
          <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.2 }}>
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
  const { hasPermission } = useAuth();
  const { isMobile } = useBreakpoint();
  const [open, setOpen] = useState(false);

  const onDashboard =
    location.pathname === '/' ||
    location.pathname.startsWith('/dashboard');

  if (!isMobile || onDashboard) return null;

  const actions = FIELD_ACTIONS.filter((a) => !a.permission || hasPermission(a.permission));

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
