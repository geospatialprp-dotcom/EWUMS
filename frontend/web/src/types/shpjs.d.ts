declare module 'shpjs' {
  type ShapefileInput = {
    shp: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: string;
    cpg?: string;
  };

  type GeoJsonFeature = {
    type?: string;
    geometry?: { type: string; coordinates: unknown };
    properties?: Record<string, unknown>;
  };

  type GeoJsonFeatureCollection = {
    type?: string;
    features?: GeoJsonFeature[];
    fileName?: string;
  };

  export function combine(args: [unknown[], unknown[]?]): GeoJsonFeatureCollection;
  export function parseShp(shp: ArrayBuffer, prj?: string | false): unknown[];
  export function parseDbf(dbf: ArrayBuffer, cpg?: string): Record<string, unknown>[];

  export default function getShapefile(
    base: ArrayBuffer | ShapefileInput | string,
    whiteList?: string[],
  ): Promise<GeoJsonFeatureCollection | GeoJsonFeatureCollection[]>;
}
