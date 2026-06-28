import type Geometry from 'ol/geom/Geometry';
import { getArea } from 'ol/sphere';

const SQ_M_PER_HECTARE = 10_000;
const SQ_M_PER_ACRE = 4_046.8564224;
const SQ_M_PER_SQ_KM = 1_000_000;

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Geodesic area from an OpenLayers geometry (projected coordinates). */
export function areaSqMetersFromGeometry(geometry: Geometry): number {
  return getArea(geometry);
}

/** Human-readable area with m², hectares, and acres. */
export function formatAreaSqM(areaSqM: number): string {
  if (!Number.isFinite(areaSqM) || areaSqM <= 0) {
    return '—';
  }

  const lines: string[] = [];

  if (areaSqM >= SQ_M_PER_SQ_KM) {
    lines.push(`${formatNumber(areaSqM / SQ_M_PER_SQ_KM, 2)} km²`);
    lines.push(`${formatNumber(areaSqM, 0)} m²`);
  } else if (areaSqM >= 100) {
    lines.push(`${formatNumber(areaSqM, 0)} m²`);
  } else {
    lines.push(`${formatNumber(areaSqM, 2)} m²`);
  }

  const hectares = areaSqM / SQ_M_PER_HECTARE;
  const acres = areaSqM / SQ_M_PER_ACRE;
  lines.push(`${formatNumber(hectares, hectares >= 10 ? 1 : 2)} ha`);
  lines.push(`${formatNumber(acres, acres >= 10 ? 1 : 2)} acres`);

  return lines.join('\n');
}

export function formatAreaFromGeometry(geometry: Geometry): string {
  return formatAreaSqM(areaSqMetersFromGeometry(geometry));
}
