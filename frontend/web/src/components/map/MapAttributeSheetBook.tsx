import type { ComponentProps } from 'react';
import { Box, Paper } from '@mui/material';
import CropFreeOutlinedIcon from '@mui/icons-material/CropFreeOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import type { FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import { mapAttributeBookSx, mapSheetTabRailSx } from '../../utils/mapChromeStyles';
import { ARCMAP } from '../gis/arcMapUi';
import MapAttributePanel from './MapAttributePanel';

export type AttributeSheet = {
  layerId: string;
  layerName: string;
  geometryType?: string;
  featureClass: FeatureClassRecord | null;
  features: ProjectFeatureRecord[];
  loading?: boolean;
};

type MapAttributePanelPassthrough = Omit<
  ComponentProps<typeof MapAttributePanel>,
  'featureClass' | 'features' | 'loading' | 'embedded'
>;

interface MapAttributeSheetBookProps extends MapAttributePanelPassthrough {
  sheets: AttributeSheet[];
  activeLayerId: string;
  onSelectSheet: (layerId: string) => void;
}

function GeometryTabIcon({ type }: { type?: string }) {
  if (type === 'LineString') return <TimelineOutlinedIcon sx={{ fontSize: 14 }} />;
  if (type === 'Polygon') return <CropFreeOutlinedIcon sx={{ fontSize: 14 }} />;
  return <PlaceOutlinedIcon sx={{ fontSize: 14 }} />;
}

function SheetTab({
  sheet,
  active,
  onClick,
}: {
  sheet: AttributeSheet;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      role="tab"
      aria-selected={active}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.4,
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: '0.75rem',
        fontWeight: active ? 700 : 500,
        color: active ? ARCMAP.text : ARCMAP.textMuted,
        bgcolor: active ? '#ffffff' : '#e8e8e8',
        borderTop: active ? `2px solid ${ARCMAP.accent}` : '2px solid transparent',
        borderLeft: `1px solid ${ARCMAP.toolbarBorder}`,
        borderRight: `1px solid ${ARCMAP.toolbarBorder}`,
        minWidth: 80,
        maxWidth: 160,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        '&:hover': { bgcolor: active ? '#ffffff' : '#f0f0f0' },
      }}
    >
      <GeometryTabIcon type={sheet.geometryType} />
      <Box component="span" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sheet.layerName}
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: active ? ARCMAP.accent : ARCMAP.textMuted,
          border: `1px solid ${ARCMAP.toolbarBorder}`,
          px: 0.5,
          lineHeight: 1.3,
        }}
      >
        {sheet.features.length}
      </Box>
    </Box>
  );
}

export default function MapAttributeSheetBook({
  sheets,
  activeLayerId,
  onSelectSheet,
  ...panelProps
}: MapAttributeSheetBookProps) {
  const activeSheet = sheets.find((sheet) => sheet.layerId === activeLayerId) ?? sheets[0];
  if (!activeSheet) return null;

  const placeholderClass: FeatureClassRecord = activeSheet.featureClass ?? {
    id: activeSheet.layerId,
    projectId: '',
    code: activeSheet.layerName,
    name: activeSheet.layerName,
    geometryType: (activeSheet.geometryType as FeatureClassRecord['geometryType']) ?? 'Point',
    attributeSchema: [],
    sortOrder: 0,
  };

  return (
    <Paper elevation={0} square sx={mapAttributeBookSx()}>
      <MapAttributePanel
        {...panelProps}
        embedded
        featureClass={placeholderClass}
        features={activeSheet.features}
        loading={activeSheet.loading || !activeSheet.featureClass}
      />

      {sheets.length > 1 && (
        <Box
          role="tablist"
          aria-label="Layer attribute sheets"
          sx={mapSheetTabRailSx()}
        >
          {sheets.map((sheet) => (
            <SheetTab
              key={sheet.layerId}
              sheet={sheet}
              active={sheet.layerId === activeSheet.layerId}
              onClick={() => onSelectSheet(sheet.layerId)}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}
