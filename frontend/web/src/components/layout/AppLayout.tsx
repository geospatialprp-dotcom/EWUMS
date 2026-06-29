import { ReactNode, useEffect, useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Tooltip, Typography, Badge, useMediaQuery, useTheme,
} from '@mui/material';

import MapIcon from '@mui/icons-material/Map';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LandscapeOutlinedIcon from '@mui/icons-material/LandscapeOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import HistoryIcon from '@mui/icons-material/History';
import InboxIcon from '@mui/icons-material/Inbox';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useAuth } from '../../context/AuthContext';
import { APP_BRAND } from '../../constants/branding';
import { formatHeaderUserCaption, formatUserProfileName } from '../../utils/userDisplayLabel';
import AppLogo from '../branding/AppLogo';
import DepartmentLogoMenu from '../branding/DepartmentLogoMenu';
import ApiModeBanner from './ApiModeBanner';
import DivisionSwitcher from './DivisionSwitcher';
import LanguageSwitcher from './LanguageSwitcher';
import HelpPanel from './HelpPanel';
import { useTranslation } from '../../context/LanguageContext';
import {
  appBarBrandRowSx,
  appBarSx,
  appBarTitleSx,
  appBarUserBlockSx,
  appBarUserNameSx,
  appDrawerBrandSx,
  appDrawerEyebrowSx,
  appDrawerNameSx,
  appDrawerPaperSx,
  appMainTopOffsetSx,
  appNavItemSx,
  appNavSectionLabelSx,
  appTouchIconButtonSx,
  APP_TOOLBAR_MIN_HEIGHT,
  DRAWER_WIDTH,
  DRAWER_WIDTH_MINI,
} from '../../utils/appShellStyles';

interface NavItem {
  path: string;
  labelKey: string;
  icon: ReactNode;
  permission?: string;
  badge?: number;
}

const mainNav: NavItem[] = [
  { path: '/platform', labelKey: 'nav.platformModules', icon: <AppsOutlinedIcon /> },
  { path: '/map', labelKey: 'nav.mapExplorer', icon: <MapIcon /> },
  { path: '/dashboard', labelKey: 'nav.executiveDashboard', icon: <DashboardIcon />, permission: 'dashboard:read' },
  { path: '/assets', labelKey: 'nav.assetRegistry', icon: <InventoryIcon />, permission: 'asset:read' },
  { path: '/workflows', labelKey: 'nav.workflowCenter', icon: <InboxIcon /> },
];

const managementNav: NavItem[] = [
  { path: '/dpr-planning', labelKey: 'nav.dprApprovalPipeline', icon: <DescriptionOutlinedIcon />, permission: 'dpr_proposal:read' },
  { path: '/land-acquisition', labelKey: 'nav.landAcquisition', icon: <LandscapeOutlinedIcon />, permission: 'la_case:read' },
  { path: '/projects', labelKey: 'nav.projectManagement', icon: <AssignmentIcon />, permission: 'project:read' },
  { path: '/om', labelKey: 'nav.omManagement', icon: <BuildCircleOutlinedIcon />, permission: 'om:read' },
  { path: '/billing', labelKey: 'nav.billingRevenue', icon: <ReceiptLongOutlinedIcon />, permission: 'om:read' },
  { path: '/mobile-billing', labelKey: 'nav.mobileBilling', icon: <PhoneAndroidOutlinedIcon />, permission: 'om:read' },
];

const adminNav: NavItem[] = [
  { path: '/admin/users', labelKey: 'nav.userManagement', icon: <PeopleIcon />, permission: 'user:read' },
  { path: '/admin/roles', labelKey: 'nav.rolesPermissions', icon: <SecurityIcon />, permission: 'user:read' },
  { path: '/admin/audit', labelKey: 'nav.auditTrail', icon: <HistoryIcon />, permission: 'audit:read' },
];

function isNavSelected(pathname: string, path: string) {
  return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();
  const userCaption = user ? formatHeaderUserCaption(user) : '';
  const userProfileName = user ? formatUserProfileName(user) : '';

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isDesktop) setSidebarCollapsed(false);
  }, [isDesktop]);

  const drawerCollapsed = !isMobile && !isDesktop && sidebarCollapsed;
  const drawerWidth = drawerCollapsed ? DRAWER_WIDTH_MINI : DRAWER_WIDTH;

  const filterNav = (items: NavItem[]) =>
    items.filter((item) => !item.permission || hasPermission(item.permission));

  const renderNavItems = (items: NavItem[]) =>
    items.map((item) => {
      const selected = isNavSelected(location.pathname, item.path);
      const label = t(item.labelKey);
      const button = (
        <ListItemButton
          key={item.path}
          selected={selected}
          onClick={() => { navigate(item.path); setMobileOpen(false); }}
          sx={appNavItemSx(selected, drawerCollapsed)}
        >
          <ListItemIcon>
            {item.badge ? (
              <Badge badgeContent={item.badge} color="error">{item.icon}</Badge>
            ) : item.icon}
          </ListItemIcon>
          <ListItemText primary={label} />
        </ListItemButton>
      );

      if (drawerCollapsed) {
        return (
          <Tooltip key={item.path} title={label} placement="right" arrow>
            {button}
          </Tooltip>
        );
      }
      return button;
    });

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={[
        appDrawerBrandSx(),
        {
          minHeight: drawerCollapsed
            ? 56
            : { xs: 88, md: APP_TOOLBAR_MIN_HEIGHT.sm },
          height: { md: drawerCollapsed ? 56 : APP_TOOLBAR_MIN_HEIGHT.sm },
          px: drawerCollapsed ? 1 : 2,
          py: { xs: 1.5, md: 0 },
          ...(drawerCollapsed ? { alignItems: 'center' as const } : {}),
        },
      ]}>
        {!drawerCollapsed && (
          isMobile ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <AppLogo height={36} />
              </Box>
              <Typography variant="overline" sx={appDrawerEyebrowSx()}>
                {APP_BRAND.sidebarEyebrow}
              </Typography>
              <Typography variant="subtitle1" sx={appDrawerNameSx()}>
                {APP_BRAND.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.75, lineHeight: 1.35, display: 'block' }}>
                {APP_BRAND.headerTitle}
              </Typography>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.25, minWidth: 0 }}>
              <AppLogo height={32} />
              <Typography variant="overline" sx={appDrawerEyebrowSx()}>
                {APP_BRAND.sidebarEyebrow}
              </Typography>
            </Box>
          )
        )}
        {!isMobile && !isDesktop && (
          <IconButton
            onClick={() => setSidebarCollapsed((v) => !v)}
            size="small"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            sx={{
              ...appTouchIconButtonSx(),
              color: '#94a3b8',
              alignSelf: drawerCollapsed ? 'center' : 'flex-end',
              mt: drawerCollapsed ? 0 : -0.5,
            }}
          >
            {sidebarCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>

      <Box sx={{ flex: 1, py: 1, overflowY: 'auto' }}>
        <List disablePadding sx={{ px: drawerCollapsed ? 0.25 : 0.5 }}>
          {renderNavItems(filterNav(mainNav))}
        </List>

        {filterNav(managementNav).length > 0 && (
          <>
            <Typography sx={appNavSectionLabelSx(drawerCollapsed)}>{t('nav.sectionManagement')}</Typography>
            <List disablePadding sx={{ px: drawerCollapsed ? 0.25 : 0.5 }}>
              {renderNavItems(filterNav(managementNav))}
            </List>
          </>
        )}

        {filterNav(adminNav).length > 0 && (
          <>
            <Typography sx={appNavSectionLabelSx(drawerCollapsed)}>{t('nav.sectionAdministration')}</Typography>
            <List disablePadding sx={{ px: drawerCollapsed ? 0.25 : 0.5 }}>
              {renderNavItems(filterNav(adminNav))}
            </List>
          </>
        )}
      </Box>
    </Box>
  );

  const drawerSx = {
    width: drawerWidth,
    flexShrink: 0,
    transition: 'width 0.2s ease',
    '& .MuiDrawer-paper': appDrawerPaperSx(drawerWidth),
  };

  return (
    <Box display="flex" height="100vh" sx={{ bgcolor: '#f1f5f9', overflow: 'hidden' }}>
      <AppBar
        position="fixed"
        sx={{
          ...appBarSx(),
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          ml: { xs: 0, md: `${drawerWidth}px` },
          transition: 'width 0.2s ease, margin 0.2s ease',
        }}
      >
        <Toolbar
          sx={{
            minHeight: APP_TOOLBAR_MIN_HEIGHT,
            gap: { xs: 0.5, sm: 1 },
            px: { xs: 1, sm: 2 },
            py: { sm: 0.5 },
            overflow: 'hidden',
          }}
        >
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Open navigation menu"
            sx={{
              mr: { xs: 0.25, sm: 1 },
              display: { md: 'none' },
              color: '#334155',
              flexShrink: 0,
              ...(isMobile ? appTouchIconButtonSx() : {}),
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box
            sx={{
              ...appBarBrandRowSx(),
              flex: { xs: 1, md: '0 1 auto' },
              maxWidth: { md: '45%', lg: '52%' },
              minWidth: 0,
            }}
          >
            <Box
              component="a"
              href={APP_BRAND.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', flexShrink: 0 }}
            >
              <AppLogo height={34} />
            </Box>
            <Typography
              variant="h6"
              noWrap={!isMobile}
              sx={{
                ...appBarTitleSx(),
                ...(isMobile
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      whiteSpace: 'normal',
                    }
                  : {}),
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                {APP_BRAND.headerTitle}
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                {APP_BRAND.headerTitleShort}
              </Box>
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 16, display: { xs: 'none', md: 'block' } }} />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 1,
              minWidth: 0,
              gap: { xs: 0.25, sm: 0.75, md: 1.25 },
              flexWrap: 'nowrap',
            }}
          >
            <DivisionSwitcher />
            <LanguageSwitcher />
            <HelpPanel />

            <Box sx={appBarUserBlockSx()}>
              {userProfileName && (
                <Box sx={appBarUserNameSx()}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: '#64748b',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      lineHeight: 1.1,
                      fontSize: '0.625rem',
                    }}
                  >
                    {userCaption}
                  </Typography>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ color: '#0f172a', fontWeight: 700, lineHeight: 1.25, mt: 0.15 }}
                  >
                    {userProfileName}
                  </Typography>
                </Box>
              )}
              <DepartmentLogoMenu />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ ...drawerSx, display: { xs: 'none', md: 'block' } }}>
        {drawer}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, ...drawerSx, width: DRAWER_WIDTH, '& .MuiDrawer-paper': appDrawerPaperSx(DRAWER_WIDTH) }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ...appMainTopOffsetSx(),
          minHeight: 0,
          minWidth: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <ApiModeBanner />
        {children}
      </Box>
    </Box>
  );
}
