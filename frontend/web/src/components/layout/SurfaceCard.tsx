import { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { sectionTitleSx, surfaceCardHeaderSx, surfaceCardSx } from '../../utils/pagePresentationStyles';

interface SurfaceCardProps {
  title?: string;
  header?: ReactNode;
  children: ReactNode;
  darkHeader?: boolean;
  flush?: boolean;
  contentSx?: Record<string, unknown>;
}

export default function SurfaceCard({ title, header, children, darkHeader, flush, contentSx }: SurfaceCardProps) {
  return (
    <Card elevation={0} sx={surfaceCardSx()}>
      {(title || header) && (
        darkHeader ? (
          <Box sx={surfaceCardHeaderSx()}>
            {header ?? (
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#f8fafc' }}>
                {title}
              </Typography>
            )}
          </Box>
        ) : (
          <Box px={2.5} pt={2} pb={flush ? 1 : 0.5}>
            {header ?? <Typography sx={sectionTitleSx()}>{title}</Typography>}
          </Box>
        )
      )}
      <CardContent sx={{
        px: flush ? 0 : 2.5,
        py: flush ? 0 : 2,
        '&:last-child': { pb: flush ? 0 : 2 },
        ...contentSx,
      }}>
        {children}
      </CardContent>
    </Card>
  );
}
