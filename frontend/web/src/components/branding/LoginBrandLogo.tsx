import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import { DEFAULT_DEPARTMENT_ID, getDepartmentById } from '../../constants/departments';

interface LoginBrandLogoProps {
  height?: number;
  showName?: boolean;
  sx?: SxProps<Theme>;
}

/** Official Uttarakhand Jal Sansthan emblem for login screens */
export default function LoginBrandLogo({
  height = 72,
  showName = true,
  sx,
}: LoginBrandLogoProps) {
  const department = getDepartmentById(DEFAULT_DEPARTMENT_ID);

  return (
    <Box sx={{ textAlign: 'center', ...sx }}>
      <Box
        component="img"
        src={department.logoUrl}
        alt={department.logoAlt}
        sx={{
          height,
          width: 'auto',
          maxWidth: height * 1.1,
          objectFit: 'contain',
          display: 'block',
          mx: 'auto',
          mb: showName ? 0.75 : 0,
        }}
      />
      {showName && (
        <>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', lineHeight: 1.3 }}>
            {department.name}
          </Typography>
          {department.nameHi && (
            <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 600, display: 'block', mt: 0.25 }}>
              {department.nameHi}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
