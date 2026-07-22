import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import LandscapeOutlinedIcon from '@mui/icons-material/LandscapeOutlined';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { isSecretariatScopedUser } from '../../utils/roleNavigation';
import { isContractorUser, isSuperAdmin } from '../../utils/operationalAccess';

export const MOBILE_BOTTOM_NAV_HEIGHT = 64;

type TabKey = 'home' | 'projects' | 'map' | 'tasks' | 'more';

function resolveTab(pathname: string): TabKey {
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname.startsWith('/workflows')) return 'tasks';
  if (
    pathname.startsWith('/dashboard') ||
    pathname === '/' ||
    pathname.startsWith('/platform')
  ) {
    return 'home';
  }
  return 'more';
}

type MoreItem = { path: string; labelKey: string; icon: React.ReactNode; permission?: string };

const MORE_ITEMS: MoreItem[] = [
  { path: '/platform', labelKey: 'nav.platformModules', icon: <AppsOutlinedIcon />, permission: 'project:read' },
  { path: '/assets', labelKey: 'nav.assetRegistry', icon: <InventoryIcon />, permission: 'asset:read' },
  { path: '/dpr-planning', labelKey: 'nav.dprApprovalPipeline', icon: <DescriptionOutlinedIcon />, permission: 'dpr_proposal:read' },
  { path: '/land-acquisition', labelKey: 'nav.landAcquisition', icon: <LandscapeOutlinedIcon />, permission: 'la_case:read' },
  { path: '/om', labelKey: 'nav.omManagement', icon: <BuildCircleOutlinedIcon />, permission: 'om:read' },
  { path: '/billing', labelKey: 'nav.billingRevenue', icon: <ReceiptLongOutlinedIcon />, permission: 'om:read' },
  { path: '/complaints', labelKey: 'nav.consumerComplaints', icon: <ReportProblemOutlinedIcon />, permission: 'om:read' },
];

/**
 * Touch-first bottom navigation for phones.
 * Desktop keeps the left sidebar; this is hidden from md+.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { hasPermission, user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const secretariatScoped = isSecretariatScopedUser(user?.roles);
  const contractorScoped = isContractorUser(user?.roles);
  const superAdminScoped = isSuperAdmin(user?.roles);

  const value = resolveTab(location.pathname);

  const moreItems = useMemo(() => {
    let items = MORE_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
    if (secretariatScoped) {
      items = items.filter((item) => item.path === '/dpr-planning');
    }
    if (contractorScoped) {
      items = items.filter((item) => ['/om', '/platform', '/assets'].includes(item.path));
    }
    if (superAdminScoped) {
      items = items.filter((item) => item.path !== '/assets');
    }
    return items;
  }, [hasPermission, secretariatScoped, contractorScoped, superAdminScoped]);

  const go = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
          pb: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.06)',
        }}
      >
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_e, next: TabKey) => {
            if (next === 'home') go('/dashboard');
            else if (next === 'projects') go('/projects');
            else if (next === 'map') go('/map');
            else if (next === 'tasks') go('/workflows');
            else setMoreOpen(true);
          }}
          sx={{
            height: MOBILE_BOTTOM_NAV_HEIGHT,
            bgcolor: 'transparent',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              px: 0.5,
              color: 'text.secondary',
              '&.Mui-selected': { color: 'primary.main' },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.6875rem',
              fontWeight: 600,
              mt: 0.25,
            },
          }}
        >
          <BottomNavigationAction value="home" label={t('nav.home')} icon={<HomeOutlinedIcon />} />
          <BottomNavigationAction value="projects" label={t('nav.projectManagement')} icon={<AssignmentOutlinedIcon />} />
          <BottomNavigationAction value="map" label={t('nav.mapExplorer')} icon={<MapOutlinedIcon />} />
          <BottomNavigationAction value="tasks" label={t('nav.tasks')} icon={<InboxOutlinedIcon />} />
          <BottomNavigationAction value="more" label={t('nav.more')} icon={<MoreHorizIcon />} />
        </BottomNavigation>
      </Paper>

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '75vh',
            pb: 'env(safe-area-inset-bottom)',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'grey.300', mx: 'auto', mb: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            {t('nav.moreModules')}
          </Typography>
        </Box>
        <List disablePadding sx={{ px: 1, pb: 2 }}>
          {moreItems.map((item) => (
            <ListItemButton
              key={item.path}
              onClick={() => go(item.path)}
              selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                minHeight: 52,
                border: '1px solid',
                borderColor: 'transparent',
                '&.Mui-selected': {
                  bgcolor: 'rgba(15, 76, 129, 0.08)',
                  borderColor: 'rgba(15, 76, 129, 0.16)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 44, color: 'primary.main' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9375rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
    </>
  );
}
