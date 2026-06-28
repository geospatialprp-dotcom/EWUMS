/** Uttarakhand state bounding box [minLon, minLat, maxLon, maxLat] WGS84 — from admin district polygons */
export const UTTARAKHAND_STATE_BBOX = [77.57, 28.72, 81.05, 31.46] as const;

export const UTTARAKHAND_STATE_MAP_VIEW = {
  center: [78.8, 30.2] as [number, number],
  zoom: 7.2,
  bbox: UTTARAKHAND_STATE_BBOX,
};

export type MapAccessScope = 'global' | 'state' | 'circle' | 'division';
