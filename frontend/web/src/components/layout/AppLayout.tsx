import { ReactNode, useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import {

  AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon,

  ListItemText, Toolbar, Typography, Badge,

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

  appNavItemSx,

  appNavSectionLabelSx,

} from '../../utils/appShellStyles';



const DRAWER_WIDTH = 260;



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

  { path: '/dashboard', labelKey: 'nav.executiveDashboard', icon: <DashboardIcon /> },

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

  const [mobileOpen, setMobileOpen] = useState(false);

  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();
  const userCaption = user ? formatHeaderUserCaption(user) : '';
  const userProfileName = user ? formatUserProfileName(user) : '';

  const navigate = useNavigate();

  const location = useLocation();



  const filterNav = (items: NavItem[]) =>

    items.filter((item) => !item.permission || hasPermission(item.permission));



  const renderNavItems = (items: NavItem[]) =>

    items.map((item) => {

      const selected = isNavSelected(location.pathname, item.path);

      return (

        <ListItemButton

          key={item.path}

          selected={selected}

          onClick={() => { navigate(item.path); setMobileOpen(false); }}

          sx={appNavItemSx(selected)}

        >

          <ListItemIcon>

            {item.badge ? (

              <Badge badgeContent={item.badge} color="error">{item.icon}</Badge>

            ) : item.icon}

          </ListItemIcon>

          <ListItemText primary={t(item.labelKey)} />

        </ListItemButton>

      );

    });



  const drawer = (

    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      <Box sx={appDrawerBrandSx()}>

        <Typography variant="overline" sx={appDrawerEyebrowSx()}>

          {APP_BRAND.sidebarEyebrow}

        </Typography>

        <Typography variant="subtitle1" sx={appDrawerNameSx()}>

          {APP_BRAND.name}

        </Typography>

      </Box>



      <Box sx={{ flex: 1, py: 1, overflowY: 'auto' }}>

        <List disablePadding sx={{ px: 0.5 }}>{renderNavItems(filterNav(mainNav))}</List>



        {filterNav(managementNav).length > 0 && (

          <>

            <Typography sx={appNavSectionLabelSx()}>{t('nav.sectionManagement')}</Typography>

            <List disablePadding sx={{ px: 0.5 }}>{renderNavItems(filterNav(managementNav))}</List>

          </>

        )}



        {filterNav(adminNav).length > 0 && (

          <>

            <Typography sx={appNavSectionLabelSx()}>{t('nav.sectionAdministration')}</Typography>

            <List disablePadding sx={{ px: 0.5 }}>{renderNavItems(filterNav(adminNav))}</List>

          </>

        )}

      </Box>

    </Box>

  );



  const drawerSx = {

    width: DRAWER_WIDTH,

    flexShrink: 0,

    '& .MuiDrawer-paper': appDrawerPaperSx(),

  };



  return (

    <Box display="flex" height="100vh" sx={{ bgcolor: '#f1f5f9' }}>

      <AppBar position="fixed" sx={{ ...appBarSx(), zIndex: (t) => t.zIndex.drawer + 1 }}>

        <Toolbar sx={{ minHeight: { xs: 56, sm: 68 }, gap: 1, py: { sm: 0.5 } }}>

          <IconButton

            edge="start"

            onClick={() => setMobileOpen(!mobileOpen)}

            sx={{ mr: 1, display: { sm: 'none' }, color: '#334155' }}

          >

            <MenuIcon />

          </IconButton>

          <Box sx={appBarBrandRowSx()}>

            <Box
              component="a"
              href={APP_BRAND.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', flexShrink: 0 }}
            >
              <AppLogo height={48} />
            </Box>

            <Typography variant="h6" noWrap sx={appBarTitleSx()}>

              {APP_BRAND.headerTitle}

            </Typography>

          </Box>

          <Box sx={{ flex: 1 }} />

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

        </Toolbar>

      </AppBar>



      <Drawer variant="permanent" sx={{ ...drawerSx, display: { xs: 'none', sm: 'block' } }}>

        {drawer}

      </Drawer>



      <Drawer

        variant="temporary"

        open={mobileOpen}

        onClose={() => setMobileOpen(false)}

        sx={{ display: { xs: 'block', sm: 'none' }, ...drawerSx }}

      >

        {drawer}

      </Drawer>



      <Box component="main" sx={{ flexGrow: 1, mt: { xs: '56px', sm: '68px' }, minHeight: 0, overflow: 'auto' }}>

        <ApiModeBanner />

        {children}

      </Box>

    </Box>

  );

}

