import { Box, Typography } from '@mui/material';
import { LA_GIS_VIZ_LEGEND } from '../../constants/laGisVisualization';

export default function LaGisVisualizationLegend({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      px={1.5}
      py={0.75}
      bgcolor="grey.50"
      display="flex"
      gap={compact ? 1 : 1.25}
      flexWrap="wrap"
      alignItems="center"
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mr: 0.5 }}>
        GIS Legend
      </Typography>
      {LA_GIS_VIZ_LEGEND.map(({ code, label, color }) => (
        <Box key={code} display="flex" alignItems="center" gap={0.5}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: code === 'road_corridor' ? 0.5 : '50%',
              bgcolor: color,
              border: code === 'rejected' ? '1px solid #fff' : 'none',
              boxShadow: code === 'rejected' ? 'inset 0 0 0 1px #d1d5db' : 'none',
            }}
          />
          <Typography variant="caption">{label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
