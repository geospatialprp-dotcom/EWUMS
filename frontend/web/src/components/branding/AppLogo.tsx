import { Box, type SxProps, type Theme } from '@mui/material';
import { APP_BRAND } from '../../constants/branding';

interface AppLogoProps {
  height?: number;
  sx?: SxProps<Theme>;
}

/** PRP Geospatial logo — sourced from prpgeospatial.com */
export default function AppLogo({ height = 36, sx }: AppLogoProps) {
  return (
    <Box
      component="img"
      src={APP_BRAND.logoUrl}
      alt={APP_BRAND.logoAlt}
      sx={{
        height,
        width: 'auto',
        maxWidth: height * 6.5,
        minHeight: height,
        objectFit: 'contain',
        objectPosition: 'left center',
        display: 'block',
        ...sx,
      }}
    />
  );
}
