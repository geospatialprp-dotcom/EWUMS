import { Box } from '@mui/material';
import type { DepartmentBrand } from '../../constants/departments';

interface DepartmentLogoProps {
  department: DepartmentBrand;
  size?: number;
  circular?: boolean;
  /** Featured badge — circular ring suited for the app header */
  badge?: boolean;
}

/** Renders a department emblem — keyed img so logo updates immediately on switch. */
export default function DepartmentLogo({
  department,
  size = 36,
  circular = false,
  badge = false,
}: DepartmentLogoProps) {
  const isRound = circular || badge;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: isRound ? '50%' : 1.5,
        overflow: 'hidden',
        bgcolor: '#fff',
        border: badge ? '3px solid #fff' : '1px solid #e2e8f0',
        outline: badge ? '2px solid #2563eb' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: badge
          ? '0 4px 14px rgba(37, 99, 235, 0.28)'
          : isRound
            ? '0 2px 8px rgba(15, 23, 42, 0.1)'
            : 'none',
      }}
    >
      <Box
        key={department.id}
        component="img"
        src={`${department.logoUrl}?id=${department.id}`}
        alt={department.logoAlt}
        sx={{
          width: badge ? '88%' : '100%',
          height: badge ? '88%' : '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </Box>
  );
}
