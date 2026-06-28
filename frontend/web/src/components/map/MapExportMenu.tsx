import { useState } from 'react';
import {
  Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import { MAP_CHROME, mapArcDesktopToolButtonSx, mapRoundIconButtonSx, mapToolbarIconSx, mapToolbarTitleBarIconButtonSx, MAP_ARC_TOOL_ICON_SIZE } from '../../utils/mapChromeStyles';

export type MapExportAction =
  | 'a4-png'
  | 'a3-png'
  | 'a4-pdf'
  | 'a3-pdf'
  | 'kml'
  | 'shp';

interface MapExportMenuProps {
  disabled?: boolean;
  compact?: boolean;
  titleBar?: boolean;
  arcDesktop?: boolean;
  onExport: (action: MapExportAction) => void;
}

export default function MapExportMenu({ disabled, compact, titleBar, arcDesktop, onExport }: MapExportMenuProps) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const choose = (action: MapExportAction) => {
    setAnchor(null);
    onExport(action);
  };

  return (
    <>
      <Tooltip title="Export map" placement="bottom">
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={(event) => setAnchor(event.currentTarget)}
            aria-label="Export map"
            sx={{
              ...(arcDesktop
                ? mapArcDesktopToolButtonSx(false)
                : titleBar
                  ? mapToolbarTitleBarIconButtonSx()
                  : mapRoundIconButtonSx(compact ? 32 : 36)),
              color: arcDesktop ? MAP_CHROME.text : titleBar ? '#ffffff' : MAP_CHROME.accent,
              '&:hover': {
                bgcolor: arcDesktop
                  ? 'rgba(49,106,197,0.08)'
                  : titleBar
                    ? 'rgba(255,255,255,0.22)'
                    : 'rgba(8, 145, 178, 0.08)',
              },
            }}
          >
            <FileDownloadOutlinedIcon sx={arcDesktop ? { fontSize: MAP_ARC_TOOL_ICON_SIZE } : titleBar ? mapToolbarIconSx('titleBar') : { fontSize: compact ? 14 : 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem disabled sx={{ opacity: 1, py: 0.5, minHeight: 28 }}>
          <ListItemText
            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary', fontWeight: 700 }}
            primary="Map layout"
          />
        </MenuItem>
        <MenuItem onClick={() => choose('a4-png')}>
          <ListItemIcon><ImageOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="A4 layout (PNG)" secondary="Landscape print sheet" />
        </MenuItem>
        <MenuItem onClick={() => choose('a3-png')}>
          <ListItemIcon><ImageOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="A3 layout (PNG)" secondary="Landscape print sheet" />
        </MenuItem>
        <MenuItem onClick={() => choose('a4-pdf')}>
          <ListItemIcon><PictureAsPdfOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="A4 layout (PDF)" secondary="Downloads landscape PDF" />
        </MenuItem>
        <MenuItem onClick={() => choose('a3-pdf')}>
          <ListItemIcon><PictureAsPdfOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="A3 layout (PDF)" secondary="Downloads landscape PDF" />
        </MenuItem>
        <Divider />
        <MenuItem disabled sx={{ opacity: 1, py: 0.5, minHeight: 28 }}>
          <ListItemText
            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary', fontWeight: 700 }}
            primary="GIS data"
          />
        </MenuItem>
        <MenuItem onClick={() => choose('kml')}>
          <ListItemIcon><MapOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="KML" secondary="Visible layers · WGS 84" />
        </MenuItem>
        <MenuItem onClick={() => choose('shp')}>
          <ListItemIcon><FolderZipOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Shapefile (.zip)" secondary="One SHP set per visible layer" />
        </MenuItem>
      </Menu>
    </>
  );
}
