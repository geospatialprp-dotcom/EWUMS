/** Offline fallback bboxes — used only when PostGIS admin polygons are unavailable. */
export const UTTARAKHAND_DISTRICT_BBOXES: Record<string, [number, number, number, number]> = {
  Almora: [79.04, 29.43, 80.08, 29.98],
  Bageshwar: [79.47, 29.70, 80.16, 30.32],
  Chamoli: [79.08, 29.93, 80.10, 31.08],
  Champawat: [79.79, 28.94, 80.32, 29.52],
  Dehradun: [77.57, 29.96, 78.31, 31.03],
  Haridwar: [77.72, 29.58, 78.34, 30.24],
  Nainital: [78.85, 28.98, 79.97, 29.61],
  'Pauri Garhwal': [78.20, 29.43, 79.23, 30.26],
  Pithoragarh: [79.82, 29.44, 81.05, 30.81],
  Rudraprayag: [78.82, 30.18, 79.35, 30.81],
  'Tehri Garhwal': [77.94, 30.05, 79.04, 30.88],
  'Udham Singh Nagar': [78.72, 28.72, 80.08, 29.36],
  Uttarkashi: [77.81, 30.47, 79.41, 31.46],
};

/** Division code → district when divisions.district column is unset. */
export const DIVISION_CODE_DISTRICT_FALLBACK: Record<string, string> = {
  'DIV-CHM': 'Chamoli',
  'DIV-KPG': 'Chamoli',
  'DIV-DDN': 'Dehradun',
  'DIV-MSR': 'Dehradun',
  'DIV-VKN': 'Dehradun',
  'DIV-RSK': 'Dehradun',
  'DIV-DRP': 'Dehradun',
  'DIV-DNN': 'Dehradun',
  'DIV-DNS': 'Dehradun',
  'DIV-DPW': 'Dehradun',
  'DIV-DRL': 'Dehradun',
  'DIV-HRW': 'Haridwar',
  'DIV-HRR': 'Haridwar',
  'DIV-NTL': 'Nainital',
  'DIV-LKU': 'Nainital',
  'DIV-HLW': 'Nainital',
  'DIV-RMG': 'Nainital',
  'DIV-ALM': 'Almora',
  'DIV-RNK': 'Almora',
  'DIV-PRG': 'Pauri Garhwal',
  'DIV-KTD': 'Pauri Garhwal',
  'DIV-TNH': 'Tehri Garhwal',
  'DIV-NTH': 'Tehri Garhwal',
  'DIV-DVP': 'Tehri Garhwal',
  'DIV-GSL': 'Tehri Garhwal',
  'DIV-UTK': 'Uttarkashi',
  'DIV-PRL': 'Uttarkashi',
  'DIV-RDP': 'Rudraprayag',
  'DIV-BGW': 'Bageshwar',
  'DIV-USN': 'Udham Singh Nagar',
  'DIV-KTM': 'Udham Singh Nagar',
  'DIV-PTG': 'Pithoragarh',
  'DIV-DDH': 'Pithoragarh',
  'DIV-CHP': 'Champawat',
};

export const DISTRICT_NAME_TO_CODE: Record<string, string> = {
  Almora: 'ALM',
  Bageshwar: 'BGW',
  Chamoli: 'CHM',
  Champawat: 'CHP',
  Dehradun: 'DDN',
  Haridwar: 'HRW',
  Nainital: 'NTL',
  'Pauri Garhwal': 'PGR',
  Pithoragarh: 'PTG',
  Rudraprayag: 'RDP',
  'Tehri Garhwal': 'TGR',
  'Udham Singh Nagar': 'USN',
  Uttarkashi: 'UTK',
};

/** Representative map center per field division (WGS 84). */
export const DIVISION_CODE_MAP_CENTER: Record<string, [number, number]> = {
  'DIV-ALM': [79.65, 29.60],
  'DIV-BGW': [79.77, 29.84],
  'DIV-CHM': [79.50, 30.35],
  'DIV-CHP': [80.28, 29.35],
  'DIV-DDN': [78.05, 30.32],
  'DIV-DDH': [80.35, 29.80],
  'DIV-DVP': [78.60, 30.15],
  'DIV-HRW': [78.00, 29.95],
  'DIV-KPG': [79.65, 30.26],
  'DIV-KTD': [78.52, 29.75],
  'DIV-KTM': [79.97, 28.92],
  'DIV-LKU': [79.52, 29.08],
  'DIV-MSR': [78.05, 30.45],
  'DIV-NTH': [78.48, 30.38],
  'DIV-NTL': [79.40, 29.38],
  'DIV-PRG': [78.78, 30.15],
  'DIV-PRL': [78.42, 30.85],
  'DIV-PTG': [80.22, 29.58],
  'DIV-RDP': [79.05, 30.28],
  'DIV-RNK': [79.55, 29.65],
  'DIV-RSK': [78.25, 30.10],
  'DIV-TNH': [78.48, 30.38],
  'DIV-USN': [79.12, 29.05],
  'DIV-UTK': [78.45, 30.73],
  'DIV-VKN': [77.95, 30.45],
  'DIV-DRP': [78.09, 30.41],
  'DIV-DNN': [78.08, 30.40],
  'DIV-DNS': [78.05, 30.25],
  'DIV-DPW': [78.02, 30.35],
  'DIV-DRL': [78.10, 30.30],
  'DIV-HRR': [78.00, 29.85],
  'DIV-HLW': [79.52, 29.22],
  'DIV-RMG': [79.13, 29.39],
  'DIV-GSL': [78.68, 30.47],
};

export function districtBboxCenter(districtName: string): [number, number] | null {
  const bbox = UTTARAKHAND_DISTRICT_BBOXES[districtName];
  if (!bbox) return null;
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

export function mapCenterForDivisionCode(code: string): [number, number] | null {
  if (DIVISION_CODE_MAP_CENTER[code]) return DIVISION_CODE_MAP_CENTER[code];
  const district = DIVISION_CODE_DISTRICT_FALLBACK[code];
  if (!district) return null;
  return districtBboxCenter(district);
}

export function districtForDivisionCode(code: string): string | null {
  return DIVISION_CODE_DISTRICT_FALLBACK[code] ?? null;
}

export function districtEnvelopeGeoJson(districtName: string, code: string) {
  const bbox = UTTARAKHAND_DISTRICT_BBOXES[districtName];
  if (!bbox) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    type: 'Polygon' as const,
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  };
}
