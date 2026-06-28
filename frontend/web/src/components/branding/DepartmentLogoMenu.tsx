import { useState } from 'react';
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useNavigate } from 'react-router-dom';
import { DEPARTMENT_BRANDS } from '../../constants/departments';
import { useDepartment } from '../../context/DepartmentContext';
import { useAuth } from '../../context/AuthContext';
import { formatUserProfileName } from '../../utils/userDisplayLabel';
import {
  appDepartmentMenuHeroSx,
  appDepartmentMenuPaperSx,
  appDepartmentSwitcherSx,
} from '../../utils/appShellStyles';
import DepartmentLogo from './DepartmentLogo';

export default function DepartmentLogoMenu() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { department, setDepartmentId } = useDepartment();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const open = Boolean(anchorEl);
  const userInitials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="Department logo and account menu"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : undefined}
        sx={appDepartmentSwitcherSx(open)}
      >
        <DepartmentLogo department={department} size={isCompact ? 40 : 50} badge />

        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            textAlign: 'left',
            minWidth: 0,
            maxWidth: 200,
          }}
        >
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
            Department
          </Typography>
          <Typography
            variant="body2"
            noWrap
            sx={{ color: '#0f172a', fontWeight: 700, lineHeight: 1.25, mt: 0.15 }}
          >
            {department.shortName}
          </Typography>
        </Box>

        <KeyboardArrowDownIcon
          sx={{
            fontSize: 20,
            color: open ? '#2563eb' : '#64748b',
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'none',
            display: { xs: 'none', sm: 'block' },
          }}
        />
      </ButtonBase>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: appDepartmentMenuPaperSx() } }}
      >
        <Box sx={appDepartmentMenuHeroSx()}>
          <Typography
            variant="overline"
            sx={{ color: '#93c5fd', letterSpacing: '0.14em', fontWeight: 700 }}
          >
            Active department
          </Typography>
          <Box display="flex" alignItems="center" gap={1.75} mt={1.25}>
            <DepartmentLogo department={department} size={64} badge />
            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
                {department.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#bfdbfe', mt: 0.35, display: 'block' }}>
                {department.shortName} · Government of Uttarakhand
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ px: 2, pt: 1.5, pb: 0.75 }}>
          <Typography
            variant="overline"
            sx={{
              color: '#64748b',
              letterSpacing: '0.12em',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <SwapHorizIcon sx={{ fontSize: 14 }} />
            Switch department
          </Typography>
        </Box>

        {DEPARTMENT_BRANDS.map((item) => {
          const selected = item.id === department.id;
          return (
            <MenuItem
              key={item.id}
              selected={selected}
              onClick={() => {
                setDepartmentId(item.id);
                setAnchorEl(null);
              }}
              sx={{
                mx: 1,
                mb: 0.5,
                py: 1.1,
                borderRadius: 2,
                border: '1px solid',
                borderColor: selected ? '#bfdbfe' : 'transparent',
                bgcolor: selected ? '#eff6ff' : 'transparent',
                '&:hover': { bgcolor: selected ? '#eff6ff' : '#f8fafc' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 48 }}>
                <DepartmentLogo department={item} size={40} circular />
              </ListItemIcon>
              <Box flex={1} minWidth={0}>
                <Typography variant="body2" fontWeight={selected ? 700 : 600} lineHeight={1.25}>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.shortName}
                </Typography>
              </Box>
              {selected && (
                <CheckCircleIcon fontSize="small" color="primary" sx={{ ml: 0.5 }} />
              )}
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 1 }} />

        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700, bgcolor: '#2563eb' }}>
            {userInitials}
          </Avatar>
          <Box minWidth={0} flex={1}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user ? formatUserProfileName(user) : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {user?.email}
            </Typography>
          </Box>
        </Box>

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
            navigate('/login');
          }}
          sx={{
            mx: 1,
            mb: 1,
            borderRadius: 2,
            color: '#dc2626',
            '&:hover': { bgcolor: '#fef2f2' },
          }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
