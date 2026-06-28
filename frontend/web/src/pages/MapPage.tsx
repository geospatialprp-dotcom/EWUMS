import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Alert, Box, Typography } from '@mui/material';
import MapViewer from '../components/map/MapViewer';
import type { MapFlyTarget } from '../components/map/MapViewer';
import MapLocationSearch from '../components/map/MapLocationSearch';
import MapAttributePanel from '../components/map/MapAttributePanel';
import MapAttributeSheetBook from '../components/map/MapAttributeSheetBook';
import MapLayerPanel from '../components/map/MapLayerPanel';
import OrthomosaicBasemapDialog, { type MapProjectOption } from '../components/map/OrthomosaicBasemapDialog';
import type { MapExportAction } from '../components/map/MapExportMenu';
import MapFloatingToolbar from '../components/map/MapFloatingToolbar';
import MapInfoDialog from '../components/map/MapInfoDialog';
import MapSpatialAnalysisPanel from '../components/map/MapSpatialAnalysisPanel';
import DigitizeAttributeDialog from '../components/map/DigitizeAttributeDialog';
import {
  featureClassesApi, gisApi, projectsApi,
  type FeatureClassRecord, type LayerJurisdictionMeta, type MapAccessContext, type ProjectFeatureRecord,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDivisionScope, useDivisionScopeKey } from '../context/DivisionContext';
import { coordinateValueForField, findCoordinateFields } from '../utils/coordinateFields';
import type { BasemapConfig } from '../utils/basemapLayers';
import {
  UTTARAKHAND_STATE_MAP_VIEW,
  DEFAULT_MAP_LAYER_CATALOG,
  findSatelliteImageryBasemap,
} from '../utils/basemapLayers';
import { buildOrthoBasemap, hasOrthomosaicBasemap, projectOrthoBasemapId } from '../utils/orthomosaicBasemap';
import type { GeocodeResult } from '../utils/geocoding';
import { normalizeMapFeature, toGeoFeatureCollection } from '../utils/mapGeoJson';
import { resolveFeatureImageFieldName } from '../utils/featureImage';
import { formatApiError } from '../utils/apiError';
import { isSuperAdmin, canPerformOperational } from '../utils/operationalAccess';
import {
  SPATIAL_OPERATIONS,
  type SpatialOperation,
  type SpatialQueryMeta,
} from '../utils/spatialAnalysis';
import { runClientSpatialQuery } from '../utils/clientSpatialQuery';
import {
  buildVisibleExportLayers,
  exportMapLayoutPdf,
  exportMapLayoutPng,
  exportVisibleLayersToKml,
  exportVisibleLayersToShapefile,
} from '../utils/mapExport';
import type { MapSnapshotResult } from '../utils/mapSnapshot';
import { MAP_CHROME, mapMapFrameSx } from '../utils/mapChromeStyles';
import {
  arcMapShellSx,
  arcMapToolbarSx,
  mapMapHeaderBarSx,
  ArcMapStatusBar,
} from '../components/gis/arcMapUi';
import {
  geometryWithinDistrictBoundaries,
  jurisdictionRestrictedForAccess,
  OUTSIDE_DISTRICT_LAYER_MESSAGE,
  OUTSIDE_JURISDICTION_MESSAGE,
} from '../utils/jurisdictionGeometry';

type GeoFeature = {
  type: 'Feature';
  id?: string;
  geometry?: { type: string; coordinates: unknown } | null;
  properties?: Record<string, unknown>;
};

type CatalogLayer = {
  id: string;
  name: string;
  sourceType: string;
  sourceConfig: BasemapConfig['sourceConfig'] & {
    featureClassId?: string;
    geometryType?: 'Point' | 'LineString' | 'Polygon' | 'Any';
    projectId?: string;
  };
  defaultStyle?: Record<string, unknown>;
};

type LayerGroup = {
  id: string;
  name: string;
  layers: CatalogLayer[];
};

const BASEMAP_GROUP_NAME = 'Basemaps';
const SPATIAL_RESULTS_LAYER_ID = '__spatial_results__';
const DISTRICT_BOUNDARIES_LAYER_ID = '__district_boundaries__';

const DISTRICT_STROKE_COLORS = [
  '#1565C0', '#C62828', '#2E7D32', '#6A1B9A', '#EF6C00',
  '#00838F', '#AD1457', '#4527A0', '#558B2F', '#F9A825',
  '#4E342E', '#37474F', '#00695C',
];

function layerStyle(layer: CatalogLayer) {
  if (layer.sourceConfig.geometryType === 'Polygon') {
    return { ...layer.defaultStyle, stroke: '#E53935', width: 3 };
  }
  return layer.defaultStyle;
}

const IDENTIFY_META_KEYS = new Set(['layerId', 'featureClassName', 'geometryType', 'featureId']);
const GIS_FEATURE_META_KEYS = new Set([
  'layerId', 'featureClassName', 'geometryType', 'featureClassId',
  'featureClassCode', 'featureId', 'attributes',
]);

function geoFeaturesToTableRecords(
  features: GeoFeature[],
  featureClass: FeatureClassRecord,
): ProjectFeatureRecord[] {
  return features.map((feature) => {
    const props = feature.properties ?? {};
    const attributes: Record<string, unknown> = {};

    if (props.attributes && typeof props.attributes === 'object' && !Array.isArray(props.attributes)) {
      Object.assign(attributes, props.attributes as Record<string, unknown>);
    }

    Object.entries(props).forEach(([key, value]) => {
      if (!GIS_FEATURE_META_KEYS.has(key)) attributes[key] = value;
    });

    return {
      type: 'Feature',
      id: String(feature.id ?? ''),
      geometry: (feature.geometry as object) ?? null,
      properties: {
        featureClassId: featureClass.id,
        featureClassCode: featureClass.code,
        featureClassName: featureClass.name,
        geometryType: featureClass.geometryType,
        attributes,
        createdAt: '',
        updatedAt: '',
      },
    };
  });
}

function mapClickPropertiesToAttributes(props: Record<string, unknown>) {
  const attrs: Record<string, unknown> = {};
  Object.entries(props).forEach(([key, value]) => {
    if (!IDENTIFY_META_KEYS.has(key) && key !== 'geometry') attrs[key] = value;
  });
  return attrs;
}

function allowedTypesForLayer(geometryType?: string) {
  if (geometryType === 'Polygon') return ['Polygon', 'MultiPolygon'];
  if (geometryType === 'LineString') return ['LineString', 'MultiLineString'];
  if (geometryType === 'Point') return ['Point', 'MultiPoint'];
  return undefined;
}

async function loadLayerFeatures(layerId: string): Promise<{
  features: GeoFeature[];
  jurisdiction?: LayerJurisdictionMeta;
}> {
  const res = await gisApi.layerFeatures(layerId);
  const data = res.data;
  const rawFeatures = Array.isArray(data) ? data : (data?.features ?? []);
  const jurisdiction = Array.isArray(data) ? undefined : data?.jurisdiction;
  const features = (rawFeatures as GeoFeature[])
    .map(normalizeMapFeature)
    .filter((feature): feature is GeoFeature => feature !== null);
  return { features, jurisdiction };
}

export default function MapPage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusLayerId = searchParams.get('layer') ?? '';
  const shouldFit = searchParams.get('fit') === '1';
  const basemapParam = searchParams.get('basemap') ?? '';
  const divisionParam = searchParams.get('division') ?? '';
  const projectParam = searchParams.get('project') ?? '';
  const { activeDivisionId } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  /** URL ?division= wins; otherwise use the global header Division switcher. */
  const effectiveDivisionId = divisionParam || activeDivisionId || '';

  const [layers, setLayers] = useState<LayerGroup[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [layerFeatures, setLayerFeatures] = useState<Record<string, GeoFeature[]>>({});
  const [activeBasemapId, setActiveBasemapId] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [activeTool, setActiveTool] = useState('info');
  const [measureResult, setMeasureResult] = useState('');
  const [fitLayerId, setFitLayerId] = useState('');
  const [fitRequestId, setFitRequestId] = useState(0);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<MapFlyTarget | null>(null);
  const [activeEditLayerId, setActiveEditLayerId] = useState('');
  const [layerAttributeCache, setLayerAttributeCache] = useState<Record<string, {
    featureClass: FeatureClassRecord;
    features: ProjectFeatureRecord[];
  }>>({});
  const [layerAttributeLoading, setLayerAttributeLoading] = useState<Record<string, boolean>>({});
  const [mapError, setMapError] = useState('');
  const [pendingGeometry, setPendingGeometry] = useState<object | null>(null);
  const [digitizeDialogOpen, setDigitizeDialogOpen] = useState(false);
  const [digitizeError, setDigitizeError] = useState('');
  const [savingDigitize, setSavingDigitize] = useState(false);
  const [digitizeShape, setDigitizeShape] = useState<'Point' | 'LineString' | 'Polygon'>('Point');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [geometryDirty, setGeometryDirty] = useState(false);
  const [focusFeature, setFocusFeature] = useState<{ featureId: string; revision: number } | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoSelectedFeatureId, setInfoSelectedFeatureId] = useState<string | null>(null);
  const [infoSelectedLayerId, setInfoSelectedLayerId] = useState('');
  const [infoSnapshot, setInfoSnapshot] = useState<string | null>(null);
  const [infoClickProperties, setInfoClickProperties] = useState<Record<string, unknown> | null>(null);
  const [snapshotRequest, setSnapshotRequest] = useState(0);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [mapLayoutRevision, setMapLayoutRevision] = useState(0);
  const pendingExportRef = useRef<MapExportAction | null>(null);
  const jurisdictionFlyRevisionRef = useRef(0);
  const [imageSaving, setImageSaving] = useState(false);
  const [spatialOperation, setSpatialOperation] = useState<SpatialOperation>('intersect');
  const [analysisTargetLayerId, setAnalysisTargetLayerId] = useState('');
  const [bufferMeters, setBufferMeters] = useState(500);
  const [queryGeometry, setQueryGeometry] = useState<object | null>(null);
  const [analysisResults, setAnalysisResults] = useState<GeoFeature[]>([]);
  const [analysisMeta, setAnalysisMeta] = useState<SpatialQueryMeta | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [clearQueryRevision, setClearQueryRevision] = useState(0);
  const [analysisFeatureClass, setAnalysisFeatureClass] = useState<FeatureClassRecord | null>(null);
  const [analysisClassLoading, setAnalysisClassLoading] = useState(false);
  const [analysisSelectedFeatureId, setAnalysisSelectedFeatureId] = useState<string | null>(null);
  const [projectOrthoBasemaps, setProjectOrthoBasemaps] = useState<Record<string, BasemapConfig | null>>({});
  const [mapProjects, setMapProjects] = useState<MapProjectOption[]>([]);
  const [projectDivisions, setProjectDivisions] = useState<Record<string, string | null>>({});
  const [orthoDialogOpen, setOrthoDialogOpen] = useState(false);
  const [mapAccess, setMapAccess] = useState<MapAccessContext | null>(null);
  const [layerJurisdiction, setLayerJurisdiction] = useState<Record<string, LayerJurisdictionMeta>>({});
  const [mapCenter, setMapCenter] = useState<[number, number]>(UTTARAKHAND_STATE_MAP_VIEW.center);
  const [mapZoom, setMapZoom] = useState(UTTARAKHAND_STATE_MAP_VIEW.zoom);
  const [jurisdictionRevision, setJurisdictionRevision] = useState(0);

  const catalogBasemaps = useMemo(
    () => layers
      .find((group) => group.name === BASEMAP_GROUP_NAME)
      ?.layers
      .filter((layer) => layer.sourceType === 'xyz' || layer.sourceType === 'none' || layer.sourceType === 'google')
      .map((layer) => ({
        id: layer.id,
        name: layer.name,
        sourceType: layer.sourceType,
        sourceConfig: layer.sourceConfig,
      })) ?? [],
    [layers],
  );

  const orthoBasemapList = useMemo(
    () => Object.values(projectOrthoBasemaps).filter((basemap): basemap is BasemapConfig => basemap != null),
    [projectOrthoBasemaps],
  );

  const basemaps = useMemo(
    () => [...orthoBasemapList, ...catalogBasemaps],
    [orthoBasemapList, catalogBasemaps],
  );

  const hqGlobalView = user?.canViewAllDivisions ?? false;
  /** Scope from Project Management links (?project=) or the active division (URL or header). */
  const hasMapScope = Boolean(projectParam || effectiveDivisionId);

  const scopedProjectIds = useMemo(() => {
    if (!hasMapScope) return null;
    if (projectParam) return new Set([projectParam]);
    if (effectiveDivisionId) {
      const ids = Object.entries(projectDivisions)
        .filter(([, divisionId]) => divisionId === effectiveDivisionId)
        .map(([projectId]) => projectId);
      return new Set(ids);
    }
    return null;
  }, [hasMapScope, projectParam, effectiveDivisionId, projectDivisions]);

  const isLayerInMapScope = useCallback((layer: {
    sourceType: string;
    sourceConfig: { projectId?: string };
    id?: string;
  }) => {
    if (layer.sourceType !== 'project_feature_class') {
      if (layer.id?.startsWith('ortho-') && scopedProjectIds) {
        const orthoProjectId = layer.id.slice('ortho-'.length);
        return scopedProjectIds.has(orthoProjectId);
      }
      return true;
    }
    const pid = layer.sourceConfig.projectId;
    if (!pid) return false;
    if (hqGlobalView && !hasMapScope) return false;
    if (!scopedProjectIds) return true;
    return scopedProjectIds.has(pid);
  }, [scopedProjectIds, hqGlobalView, hasMapScope]);

  const scopedOrthoBasemaps = useMemo(() => {
    if (hqGlobalView && !hasMapScope) return [];
    if (!scopedProjectIds) return orthoBasemapList;
    return orthoBasemapList.filter((basemap) => scopedProjectIds.has(basemap.id.slice('ortho-'.length)));
  }, [orthoBasemapList, scopedProjectIds, hqGlobalView, hasMapScope]);

  const filterLayerGroup = useCallback((group: LayerGroup): LayerGroup => ({
    ...group,
    layers: group.layers.filter((layer) => isLayerInMapScope(layer)),
  }), [isLayerInMapScope]);

  const explorerLayers = useMemo(() => {
    const scopedCatalog = layers
      .map(filterLayerGroup)
      .filter((group) => group.name === BASEMAP_GROUP_NAME || group.layers.length > 0);

    if (!scopedOrthoBasemaps.length) return scopedCatalog;

    return scopedCatalog.map((group) => {
      if (group.name !== BASEMAP_GROUP_NAME) return group;
      return {
        ...group,
        layers: [
          ...scopedOrthoBasemaps.map((basemap) => ({
            id: basemap.id,
            name: basemap.name,
            sourceType: basemap.sourceType,
            sourceConfig: basemap.sourceConfig,
          })),
          ...group.layers.filter((layer) => !layer.id.startsWith('ortho-')),
        ],
      };
    });
  }, [layers, scopedOrthoBasemaps, filterLayerGroup]);

  const featureClassLayers = useMemo(
    () => layers
      .flatMap((group) => group.layers.filter((layer) => layer.sourceType === 'project_feature_class'))
      .filter(isLayerInMapScope),
    [layers, isLayerInMapScope],
  );

  const activeEditLayer = useMemo(
    () => featureClassLayers.find((layer) => layer.id === activeEditLayerId) ?? null,
    [featureClassLayers, activeEditLayerId],
  );

  const visibleFeatureClassLayers = useMemo(
    () => featureClassLayers.filter((layer) => layerVisibility[layer.id]),
    [featureClassLayers, layerVisibility],
  );

  const editFeatureClass = useMemo(
    () => (activeEditLayerId ? layerAttributeCache[activeEditLayerId]?.featureClass ?? null : null),
    [activeEditLayerId, layerAttributeCache],
  );

  const tableFeatures = useMemo(
    () => (activeEditLayerId ? layerAttributeCache[activeEditLayerId]?.features ?? [] : []),
    [activeEditLayerId, layerAttributeCache],
  );

  const tableLoading = Boolean(activeEditLayerId && layerAttributeLoading[activeEditLayerId]);

  const attributeSheets = useMemo(
    () => visibleFeatureClassLayers
      .filter((layer) => !layerJurisdiction[layer.id]?.blockedOutsideDistrict)
      .map((layer) => ({
      layerId: layer.id,
      layerName: layer.name,
      geometryType: layer.sourceConfig.geometryType,
      featureClass: layerAttributeCache[layer.id]?.featureClass ?? null,
      features: layerAttributeCache[layer.id]?.features ?? [],
      loading: layerAttributeLoading[layer.id] ?? false,
    })),
    [visibleFeatureClassLayers, layerAttributeCache, layerAttributeLoading, layerJurisdiction],
  );

  const attributeDockVisible = useMemo(
    () =>
      (visibleFeatureClassLayers.length > 0 && activeTool !== 'info' && activeTool !== 'analyze')
      || (Boolean(analysisFeatureClass) && activeTool === 'analyze'),
    [visibleFeatureClassLayers.length, activeTool, analysisFeatureClass],
  );

  const mapProjectOptions = useMemo(() => {
    const ids = new Set<string>();
    featureClassLayers.forEach((layer) => {
      if (layer.sourceConfig.projectId) ids.add(layer.sourceConfig.projectId);
    });
    if (!ids.size) return mapProjects;
    return mapProjects.filter((project) => ids.has(project.id));
  }, [featureClassLayers, mapProjects]);

  const defaultOrthoProjectId = useMemo(() => {
    const focusProjectId = featureClassLayers.find((layer) => layer.id === focusLayerId)?.sourceConfig.projectId;
    const fromLayer = focusProjectId
      ?? activeEditLayer?.sourceConfig.projectId
      ?? featureClassLayers.find((layer) => layerVisibility[layer.id])?.sourceConfig.projectId;
    if (fromLayer && mapProjectOptions.some((project) => project.id === fromLayer)) {
      return fromLayer;
    }
    return mapProjectOptions[0]?.id;
  }, [focusLayerId, activeEditLayer, featureClassLayers, layerVisibility, mapProjectOptions]);

  const layerGeometryType = activeEditLayer?.sourceConfig.geometryType;
  const isMixedLayer = layerGeometryType === 'Any';
  const isPolygonLayer = layerGeometryType === 'Polygon';
  // For a mixed ('Any') layer the user chooses which shape to digitize; polygon tool always draws polygons.
  const digitizeGeometryType = (
    activeTool === 'polygon'
      ? 'Polygon'
      : isMixedLayer
        ? digitizeShape
        : layerGeometryType
  ) as 'Point' | 'LineString' | 'Polygon' | undefined;

  const totalFeatures = useMemo(
    () => Object.values(layerFeatures).reduce((sum, features) => sum + features.length, 0),
    [layerFeatures],
  );

  const visibleLayerCount = useMemo(
    () => Object.values(layerVisibility).filter(Boolean).length,
    [layerVisibility],
  );

  const activeBasemapName = useMemo(
    () => basemaps.find((basemap) => basemap.id === activeBasemapId)?.name,
    [basemaps, activeBasemapId],
  );

  const refreshMapLayerFeatures = useCallback(async (layerId: string) => {
    const { features, jurisdiction } = await loadLayerFeatures(layerId);
    setLayerFeatures((prev) => ({ ...prev, [layerId]: features }));
    if (jurisdiction) {
      setLayerJurisdiction((prev) => ({ ...prev, [layerId]: jurisdiction }));
      if (jurisdiction.blockedOutsideDistrict) {
        setMapError(jurisdiction.message ?? OUTSIDE_DISTRICT_LAYER_MESSAGE);
      }
    }
    return features;
  }, []);

  const refreshEditLayerData = useCallback(async (layer: CatalogLayer) => {
    const { projectId, featureClassId } = layer.sourceConfig;
    if (!projectId || !featureClassId) return;
    if (layerJurisdiction[layer.id]?.blockedOutsideDistrict) return;

    setLayerAttributeLoading((prev) => ({ ...prev, [layer.id]: true }));
    setMapError('');
    try {
      const [classRes, featuresRes] = await Promise.all([
        featureClassesApi.get(projectId, featureClassId),
        featureClassesApi.listFeatures(projectId, featureClassId),
      ]);
      setLayerAttributeCache((prev) => ({
        ...prev,
        [layer.id]: {
          featureClass: classRes.data,
          features: featuresRes.data,
        },
      }));
    } catch (err) {
      setMapError(formatApiError(err, 'Failed to load attribute table.'));
      setLayerAttributeCache((prev) => {
        const next = { ...prev };
        delete next[layer.id];
        return next;
      });
    } finally {
      setLayerAttributeLoading((prev) => ({ ...prev, [layer.id]: false }));
    }
  }, [layerJurisdiction]);

  const applyMapAccessView = useCallback((access: MapAccessContext) => {
    setMapAccess(access);
    setMapCenter(access.mapView.center);
    setMapZoom(access.mapView.zoom);
    setJurisdictionRevision((value) => value + 1);
    setFitLayerId('');
    jurisdictionFlyRevisionRef.current += 1;
    setFlyToTarget({
      lon: access.mapView.center[0],
      lat: access.mapView.center[1],
      bbox: access.bbox,
      zoom: access.mapView.zoom,
      showMarker: false,
      revision: jurisdictionFlyRevisionRef.current,
    });
  }, []);

  const divisionHighlightMode = useMemo(() => {
    if (!mapAccess) return false;
    if (effectiveDivisionId) return true;
    return !mapAccess.canViewAllDivisions && (mapAccess.districtBoundaries?.features?.length ?? 0) > 0;
  }, [mapAccess, effectiveDivisionId]);

  const assertGeometryInJurisdiction = useCallback((geometry: GeoFeature['geometry']) => {
    if (!jurisdictionRestrictedForAccess(mapAccess)) return true;
    if (!geometry) return false;
    return geometryWithinDistrictBoundaries(geometry, mapAccess?.districtBoundaries);
  }, [mapAccess]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMapError('');

    const applyCatalog = (
      catalog: LayerGroup[],
      scopedProjectIds: Set<string>,
      access: MapAccessContext | null,
    ) => {
      setLayers(catalog);

      const layerInScope = (layer: LayerGroup['layers'][number]) => {
        if (layer.sourceType !== 'project_feature_class') return true;
        const pid = layer.sourceConfig.projectId;
        if (!pid) return false;
        if (access?.canViewAllDivisions && !effectiveDivisionId && !projectParam) return false;
        if (projectParam) return pid === projectParam;
        if (effectiveDivisionId) return scopedProjectIds.size > 0 && scopedProjectIds.has(pid);
        return true;
      };

      const vis: Record<string, boolean> = {};
      const basemapGroup = catalog.find((group) => group.name === BASEMAP_GROUP_NAME);
      const defaultBasemap = basemapGroup?.layers[0];
      const satelliteBasemap = findSatelliteImageryBasemap(basemapGroup?.layers ?? []);
      const legacySatelliteBasemap = basemapGroup?.layers.find((layer) => layer.name === 'Satellite Imagery');
      const imageryBasemap = satelliteBasemap ?? legacySatelliteBasemap;
      const preferredBasemap = (basemapParam === 'google' || basemapParam === 'satellite') && imageryBasemap
        ? imageryBasemap
        : undefined;
      const initialBasemap = preferredBasemap
        ?? satelliteBasemap
        ?? defaultBasemap
        ?? basemapGroup?.layers.find((layer) => layer.sourceType === 'xyz')
        ?? basemapGroup?.layers.find((layer) => layer.sourceType !== 'none');

      const scopedFeatureLayers = catalog
        .flatMap((group) => group.layers)
        .filter((layer) => layer.sourceType === 'project_feature_class' && layerInScope(layer));

      catalog.forEach((group) => {
        group.layers.forEach((layer) => {
          if (group.name === BASEMAP_GROUP_NAME) {
            vis[layer.id] = initialBasemap ? layer.id === initialBasemap.id : layer.sourceType === 'xyz';
            return;
          }
          if (layer.sourceType !== 'project_feature_class') {
            vis[layer.id] = false;
            return;
          }
          if (!layerInScope(layer)) {
            vis[layer.id] = false;
            return;
          }
          if (focusLayerId) {
            vis[layer.id] = layer.id === focusLayerId;
            return;
          }
          if (hasMapScope && (projectParam || effectiveDivisionId)) {
            vis[layer.id] = true;
            return;
          }
          vis[layer.id] = false;
        });
      });

      if (initialBasemap) setActiveBasemapId(initialBasemap.id);
      setLayerVisibility(vis);
      const editLayer = focusLayerId
        || scopedFeatureLayers[0]?.id
        || '';
      if (editLayer) setActiveEditLayerId(editLayer);
    };

    void (async () => {
      const [projectsResult, accessResult, layersResult] = await Promise.allSettled([
        projectsApi.list(),
        gisApi.mapAccess(effectiveDivisionId || undefined),
        gisApi.layers(),
      ]);

      if (cancelled) return;

      let scopedProjectIds = new Set<string>();
      if (projectsResult.status === 'fulfilled') {
        const projects = projectsResult.value.data as Array<{
          id: string;
          name?: string;
          divisionId?: string | null;
          orthomosaicConfig?: unknown;
        }>;
        const divisions: Record<string, string | null> = {};
        projects.forEach((project) => {
          divisions[project.id] = project.divisionId ?? null;
        });
        setProjectDivisions(divisions);
        setMapProjects(projects.map((project) => ({
          id: project.id,
          name: project.name ?? 'Project',
          orthomosaicConfig: project.orthomosaicConfig ?? null,
        })));
        if (projectParam) {
          scopedProjectIds = new Set([projectParam]);
        } else if (effectiveDivisionId) {
          scopedProjectIds = new Set(
            projects.filter((p) => p.divisionId === effectiveDivisionId).map((p) => p.id),
          );
        }
      }

      if (accessResult.status === 'fulfilled') {
        const accessData = accessResult.value.data;
        if (accessData && typeof accessData === 'object' && 'mapView' in accessData) {
          applyMapAccessView(accessData as MapAccessContext);
        } else {
          applyMapAccessView({
            accessScope: 'global',
            canViewAllDivisions: true,
            jurisdictionLabel: 'Enterprise GIS',
            districtNames: [],
            activeDistrictName: null,
            districtBoundaries: { type: 'FeatureCollection', features: [] },
            divisions: [],
            activeDivisionId: null,
            mapView: { center: UTTARAKHAND_STATE_MAP_VIEW.center, zoom: UTTARAKHAND_STATE_MAP_VIEW.zoom },
            bbox: UTTARAKHAND_STATE_MAP_VIEW.bbox,
            allowedProjectCount: null,
          });
        }
      } else {
        applyMapAccessView({
          accessScope: 'global',
          canViewAllDivisions: true,
          jurisdictionLabel: 'Enterprise GIS',
          districtNames: [],
          activeDistrictName: null,
          districtBoundaries: { type: 'FeatureCollection', features: [] },
          divisions: [],
          activeDivisionId: null,
          mapView: { center: UTTARAKHAND_STATE_MAP_VIEW.center, zoom: UTTARAKHAND_STATE_MAP_VIEW.zoom },
          bbox: UTTARAKHAND_STATE_MAP_VIEW.bbox,
          allowedProjectCount: null,
        });
        setMapError(formatApiError(accessResult.reason, 'Could not load map jurisdiction. Showing default view.'));
      }

      const mapAccessData = accessResult.status === 'fulfilled'
        && accessResult.value.data
        && typeof accessResult.value.data === 'object'
        && 'mapView' in accessResult.value.data
        ? accessResult.value.data as MapAccessContext
        : null;

      if (layersResult.status === 'fulfilled') {
        const raw = layersResult.value.data;
        const catalog = Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null && 'layers' in raw[0]
          ? raw as LayerGroup[]
          : DEFAULT_MAP_LAYER_CATALOG as LayerGroup[];
        applyCatalog(catalog, scopedProjectIds, mapAccessData);
      } else {
        setMapError((prev) => prev || formatApiError(layersResult.reason, 'Could not load map layers.'));
      }

      setLoading(false);
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [focusLayerId, basemapParam, effectiveDivisionId, projectParam, divisionScopeKey, searchParams.get('t'), applyMapAccessView, hqGlobalView, hasMapScope]);

  useEffect(() => {
    setLayerVisibility((prev) => {
      const next = { ...prev };
      let changed = false;
      layers.forEach((group) => {
        group.layers.forEach((layer) => {
          if (layer.sourceType === 'project_feature_class' && !isLayerInMapScope(layer) && next[layer.id]) {
            next[layer.id] = false;
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
    if (activeEditLayerId && !featureClassLayers.some((layer) => layer.id === activeEditLayerId)) {
      setActiveEditLayerId(featureClassLayers[0]?.id ?? '');
    }
  }, [scopedProjectIds, layers, isLayerInMapScope, featureClassLayers, activeEditLayerId, hqGlobalView, hasMapScope]);

  useEffect(() => {
    const visibleFeatureClassLayers = featureClassLayers.filter(
      (layer) => layerVisibility[layer.id],
    );

    const hiddenIds = featureClassLayers
      .filter((layer) => !layerVisibility[layer.id])
      .map((layer) => layer.id);

    if (hiddenIds.length) {
      setLayerFeatures((prev) => {
        const next = { ...prev };
        hiddenIds.forEach((id) => delete next[id]);
        return next;
      });
    }

    if (!visibleFeatureClassLayers.length) return;

    setFeaturesLoading(true);
    Promise.all(
      visibleFeatureClassLayers.map(async (layer) => {
        const loaded = await loadLayerFeatures(layer.id);
        return { layerId: layer.id, ...loaded };
      }),
    )
      .then((results) => {
        setLayerFeatures((prev) => {
          const next = { ...prev };
          results.forEach(({ layerId, features }) => {
            next[layerId] = features;
          });
          return next;
        });
        setLayerJurisdiction((prev) => {
          const next = { ...prev };
          results.forEach(({ layerId, jurisdiction }) => {
            if (jurisdiction) next[layerId] = jurisdiction;
          });
          return next;
        });
        const blockedFocus = results.find(
          (result) => result.layerId === focusLayerId && result.jurisdiction?.blockedOutsideDistrict,
        );
        if (blockedFocus?.jurisdiction) {
          setMapError(blockedFocus.jurisdiction.message ?? OUTSIDE_DISTRICT_LAYER_MESSAGE);
          setLayerVisibility((prev) => ({ ...prev, [focusLayerId]: false }));
          setActiveEditLayerId('');
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('layer');
          nextParams.delete('fit');
          navigate(`/map?${nextParams.toString()}`, { replace: true });
          return;
        }
      })
      .finally(() => setFeaturesLoading(false));
  }, [featureClassLayers, layerVisibility, focusLayerId, navigate, searchParams]);

  useEffect(() => {
    visibleFeatureClassLayers.forEach((layer) => {
      void refreshEditLayerData(layer);
    });

    setLayerAttributeCache((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((layerId) => {
        if (!layerVisibility[layerId]) delete next[layerId];
      });
      return next;
    });
    setLayerAttributeLoading((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((layerId) => {
        if (!layerVisibility[layerId]) delete next[layerId];
      });
      return next;
    });
  }, [visibleFeatureClassLayers, layerVisibility, refreshEditLayerData]);

  useEffect(() => {
    if (activeEditLayerId || !visibleFeatureClassLayers.length) return;
    setActiveEditLayerId(visibleFeatureClassLayers[0].id);
  }, [activeEditLayerId, visibleFeatureClassLayers]);

  useEffect(() => {
    if (!activeEditLayer || !layerVisibility[activeEditLayer.id]) {
      setSelectedFeatureId(null);
      setGeometryDirty(false);
    }
  }, [activeEditLayer?.id, layerVisibility[activeEditLayer?.id ?? '']]);

  useEffect(() => {
    if (!mapReady) return;
    projectsApi.list()
      .then((res) => {
        const projects = res.data as Array<{
          id: string;
          name: string;
          divisionId?: string | null;
          orthomosaicConfig?: unknown;
        }>;
        const divisions: Record<string, string | null> = {};
        projects.forEach((project) => {
          divisions[project.id] = project.divisionId ?? null;
        });
        setProjectDivisions(divisions);
        setMapProjects(projects.map((project) => ({
          id: project.id,
          name: project.name,
          orthomosaicConfig: project.orthomosaicConfig,
        })));
        setProjectOrthoBasemaps(() => {
          const next: Record<string, BasemapConfig | null> = {};
          projects.forEach((project) => {
            if (hasOrthomosaicBasemap(project.orthomosaicConfig)) {
              next[project.id] = buildOrthoBasemap(project.id, project.name, project.orthomosaicConfig);
            }
          });
          return next;
        });
      })
      .catch(() => undefined);
  }, [mapReady]);

  useEffect(() => {
    if (!orthoBasemapList.length) return;
    setLayerVisibility((prev) => {
      const next = { ...prev };
      let changed = false;
      orthoBasemapList.forEach((basemap) => {
        if (next[basemap.id] === undefined) {
          next[basemap.id] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [orthoBasemapList]);

  useEffect(() => {
    const focusLayer = focusLayerId
      ? featureClassLayers.find((layer) => layer.id === focusLayerId)
      : activeEditLayer;
    const projectId = focusLayer?.sourceConfig.projectId;
    if (basemapParam !== 'ortho') return;

    const ortho = projectId ? projectOrthoBasemaps[projectId] : orthoBasemapList[0];
    if (!ortho) return;

    setActiveBasemapId(ortho.id);
    setLayerVisibility((prev) => {
      const next = { ...prev, [ortho.id]: true };
      basemaps.forEach((basemap) => {
        if (basemap.id !== ortho.id) next[basemap.id] = false;
      });
      return next;
    });
  }, [basemapParam, focusLayerId, activeEditLayer, featureClassLayers, projectOrthoBasemaps, basemaps, orthoBasemapList]);

  useEffect(() => {
    if (!mapReady || basemapParam !== 'ortho') return;
    if (!orthoBasemapList.length) {
      setOrthoDialogOpen(true);
      return;
    }
    setMapError((prev) => (
      prev.startsWith('No drone orthomosaic is configured') ? '' : prev
    ));
  }, [mapReady, basemapParam, orthoBasemapList.length]);

  const applyOrthomosaicBasemap = useCallback((projectId: string, basemap: BasemapConfig) => {
    setProjectOrthoBasemaps((prev) => ({ ...prev, [projectId]: basemap }));
    setActiveBasemapId(basemap.id);
    setLayerVisibility((prev) => {
      const next = { ...prev, [basemap.id]: true };
      basemaps.forEach((entry) => {
        if (entry.id !== basemap.id) next[entry.id] = false;
      });
      return next;
    });
  }, [basemaps]);

  const handleOrthomosaicSubmit = useCallback(async (
    projectId: string,
    tileUrl: string,
    name?: string,
  ) => {
    const projectName = mapProjects.find((project) => project.id === projectId)?.name ?? 'Project';
    await projectsApi.update(projectId, {
      orthomosaicConfig: { tileUrl, name },
    });
    setMapProjects((prev) => prev.map((project) => (
      project.id === projectId
        ? { ...project, orthomosaicConfig: { sourceType: 'xyz', tileUrl, name } }
        : project
    )));
    const basemap = buildOrthoBasemap(projectId, projectName, { sourceType: 'xyz', tileUrl, name });
    applyOrthomosaicBasemap(projectId, basemap);
    setMapError('');
  }, [applyOrthomosaicBasemap, mapProjects]);

  const handleOrthomosaicUpload = useCallback(async (
    projectId: string,
    file: File,
    name?: string,
  ) => {
    const res = await projectsApi.uploadOrthomosaic(projectId, file, name);
    const project = res.data as { id: string; name: string; orthomosaicConfig?: unknown };
    setMapProjects((prev) => prev.map((entry) => (
      entry.id === projectId
        ? { ...entry, orthomosaicConfig: project.orthomosaicConfig }
        : entry
    )));
    const basemap = buildOrthoBasemap(projectId, project.name, project.orthomosaicConfig);
    applyOrthomosaicBasemap(projectId, basemap);
    setMapError('');
  }, [applyOrthomosaicBasemap]);

  const handleOrthomosaicRemove = useCallback(async (projectId: string) => {
    await projectsApi.removeOrthomosaic(projectId);
    const orthoId = projectOrthoBasemapId(projectId);
    const fallback = catalogBasemaps[0];

    setMapProjects((prev) => prev.map((project) => (
      project.id === projectId ? { ...project, orthomosaicConfig: null } : project
    )));
    setProjectOrthoBasemaps((prev) => ({ ...prev, [projectId]: null }));
    setActiveBasemapId((current) => (current === orthoId ? (fallback?.id ?? '') : current));
    setLayerVisibility((prev) => {
      const next = { ...prev };
      delete next[orthoId];
      catalogBasemaps.forEach((basemap) => {
        next[basemap.id] = basemap.id === (fallback?.id ?? '');
      });
      return next;
    });
    setMapError('');
  }, [catalogBasemaps]);

  useEffect(() => {
    setSelectedFeatureId(null);
    setGeometryDirty(false);
  }, [activeEditLayer?.id]);

  const lastAutoToolLayerIdRef = useRef('');

  useEffect(() => {
    if (!activeEditLayer || !layerVisibility[activeEditLayer.id]) {
      lastAutoToolLayerIdRef.current = '';
      return;
    }

    if (lastAutoToolLayerIdRef.current === activeEditLayer.id) return;
    lastAutoToolLayerIdRef.current = activeEditLayer.id;

    const count = layerFeatures[activeEditLayer.id]?.length ?? 0;
    setActiveTool(count > 0 ? 'edit' : 'digitize');
  }, [activeEditLayer?.id, layerVisibility, layerFeatures, activeEditLayer]);

  useEffect(() => {
    if (!tableFeatures.length) {
      setSelectedFeatureId(null);
      return;
    }
    if (selectedFeatureId && tableFeatures.some((feature) => feature.id === selectedFeatureId)) {
      return;
    }
    setSelectedFeatureId(tableFeatures[0].id);
  }, [tableFeatures, activeEditLayer?.id]);

  const mapFitLayerId = useMemo(() => {
    if (fitLayerId && (layerFeatures[fitLayerId]?.length ?? 0) > 0) return fitLayerId;
    if (shouldFit && focusLayerId && (layerFeatures[focusLayerId]?.length ?? 0) > 0) {
      return focusLayerId;
    }
    return undefined;
  }, [layerFeatures, focusLayerId, shouldFit, fitLayerId]);

  const mapFitFeatureCount = mapFitLayerId ? (layerFeatures[mapFitLayerId]?.length ?? 0) : 0;

  useEffect(() => {
    if (!mapFitLayerId || mapFitFeatureCount <= 0) return;
    setFitRequestId((value) => value + 1);

    const features = layerFeatures[mapFitLayerId] ?? [];
    if (features.length === 1 && features[0].id) {
      const featureId = features[0].id;
      setSelectedFeatureId(featureId);
      setFocusFeature((prev) => ({
        featureId,
        revision: (prev?.revision ?? 0) + 1,
      }));
    }
  }, [mapFitLayerId, mapFitFeatureCount, layerFeatures]);

  const requestLayerFit = useCallback((layerId: string) => {
    setFitLayerId(layerId);
    setFitRequestId((value) => value + 1);
  }, []);

  const focusLayerBlocked = Boolean(
    focusLayerId && !featuresLoading && layerJurisdiction[focusLayerId]?.blockedOutsideDistrict,
  );

  const waitingForImportView = shouldFit && Boolean(focusLayerId)
    && !focusLayerBlocked
    && featuresLoading;

  const jurisdictionBboxKey = mapAccess?.bbox?.join(',') ?? 'state';

  const overlayLayers = useMemo(() => {
    const layers = [];

    if (mapAccess?.districtBoundaries?.features?.length) {
      const isStateView = mapAccess.canViewAllDivisions && !divisionHighlightMode;
      mapAccess.districtBoundaries.features.forEach((feature, index) => {
        const stroke = isStateView
          ? DISTRICT_STROKE_COLORS[index % DISTRICT_STROKE_COLORS.length]
          : '#1565C0';
        layers.push({
          id: `${DISTRICT_BOUNDARIES_LAYER_ID}-${String(feature.id ?? index)}`,
          name: String(feature.properties?.districtName ?? 'District Boundary'),
          visible: true,
          geometryType: 'Polygon',
          style: {
            stroke,
            fillOpacity: isStateView ? 0.12 : 0.22,
            width: isStateView ? 2 : 4,
          },
          features: {
            type: 'FeatureCollection' as const,
            features: [{
              ...feature,
              properties: {
                ...(feature.properties ?? {}),
                markerColor: stroke,
              },
            }],
          },
        });
      });
    }

    featureClassLayers.forEach((layer) => {
      layers.push({
        id: layer.id,
        name: layer.name,
        visible: layerVisibility[layer.id] ?? false,
        geometryType: layer.sourceConfig.geometryType,
        style: layerStyle(layer),
        features: toGeoFeatureCollection(
          layerFeatures[layer.id] ?? [],
          allowedTypesForLayer(layer.sourceConfig.geometryType),
        ),
      });
    });

    if (analysisResults.length > 0) {
      layers.push({
        id: SPATIAL_RESULTS_LAYER_ID,
        name: 'Analysis results',
        visible: true,
        geometryType: undefined,
        style: { stroke: '#00897B', fill: '#00897B', width: 4, radius: 10 },
        features: toGeoFeatureCollection(analysisResults),
      });
    }

    return layers;
  }, [featureClassLayers, layerVisibility, layerFeatures, analysisResults, mapAccess, divisionHighlightMode]);

  const toggleLayer = (groupName: string, layerId: string, enabled: boolean) => {
    if (groupName === BASEMAP_GROUP_NAME) {
      setActiveBasemapId(layerId);
      setLayerVisibility((prev) => {
        const next = { ...prev };
        basemaps.forEach((basemap) => {
          next[basemap.id] = basemap.id === layerId;
        });
        return next;
      });
      return;
    }

    setLayerVisibility((prev) => {
      const next = { ...prev, [layerId]: enabled };
      if (!enabled && activeEditLayerId === layerId) {
        const nextVisible = featureClassLayers.find(
          (layer) => layer.id !== layerId && next[layer.id],
        );
        setActiveEditLayerId(nextVisible?.id ?? '');
      }
      return next;
    });
    if (enabled) {
      requestLayerFit(layerId);
      setActiveEditLayerId(layerId);
    }
  };

  const toggleGroupLayers = useCallback((groupId: string, enabled: boolean) => {
    const group = explorerLayers.find((entry) => entry.id === groupId);
    if (!group || group.name === BASEMAP_GROUP_NAME) return;

    setLayerVisibility((prev) => {
      const next = { ...prev };
      group.layers.forEach((layer) => {
        next[layer.id] = enabled;
      });

      if (!enabled && group.layers.some((layer) => layer.id === activeEditLayerId)) {
        const nextVisible = featureClassLayers.find((layer) => next[layer.id]);
        setActiveEditLayerId(nextVisible?.id ?? '');
      } else if (enabled && !group.layers.some((layer) => layer.id === activeEditLayerId)) {
        const firstLayer = group.layers[0];
        if (firstLayer) {
          requestLayerFit(firstLayer.id);
          setActiveEditLayerId(firstLayer.id);
        }
      }
      return next;
    });
  }, [explorerLayers, featureClassLayers, activeEditLayerId, requestLayerFit]);

  const toggleAllLayers = useCallback((enabled: boolean) => {
    setLayerVisibility((prev) => {
      const next = { ...prev };
      featureClassLayers.forEach((layer) => {
        next[layer.id] = enabled;
      });

      if (!enabled) {
        setActiveEditLayerId('');
      } else if (!next[activeEditLayerId]) {
        const firstVisible = featureClassLayers.find((layer) => next[layer.id]);
        if (firstVisible) {
          requestLayerFit(firstVisible.id);
          setActiveEditLayerId(firstVisible.id);
        }
      }
      return next;
    });
  }, [featureClassLayers, activeEditLayerId, requestLayerFit]);

  const selectEditLayer = (layerId: string) => {
    if (!layerVisibility[layerId]) {
      setLayerVisibility((prev) => ({ ...prev, [layerId]: true }));
    }
    requestLayerFit(layerId);
    setActiveEditLayerId(layerId);
  };

  const clearAnalysis = useCallback(() => {
    setQueryGeometry(null);
    setAnalysisResults([]);
    setAnalysisMeta(null);
    setAnalysisSelectedFeatureId(null);
    setClearQueryRevision((value) => value + 1);
  }, []);

  const runSpatialAnalysis = useCallback(async (geometryOverride?: object) => {
    const geometry = geometryOverride ?? queryGeometry;
    if (!geometry || !analysisTargetLayerId) return;

    const targetLayer = featureClassLayers.find((layer) => layer.id === analysisTargetLayerId);

    if (!assertGeometryInJurisdiction(geometry as GeoFeature['geometry'])) {
      setMapError(OUTSIDE_JURISDICTION_MESSAGE);
      return;
    }

    setAnalysisLoading(true);
    setMapError('');
    try {
      const response = await gisApi.spatialQuery({
        operation: spatialOperation,
        geometry,
        layerId: analysisTargetLayerId,
        distance: spatialOperation === 'buffer' ? bufferMeters : undefined,
      });
      const normalized = (response.data.features ?? [])
        .map(normalizeMapFeature)
        .filter((feature): feature is GeoFeature => feature !== null);
      setAnalysisResults(normalized);
      setAnalysisMeta(response.data.meta);
      if (normalized.length === 1) {
        setAnalysisSelectedFeatureId(String(normalized[0].id ?? ''));
      } else {
        setAnalysisSelectedFeatureId(null);
      }
    } catch (err) {
      const routeMissing = axios.isAxiosError(err) && (
        err.response?.status === 404
        || (typeof err.response?.data === 'object'
          && err.response?.data !== null
          && typeof (err.response.data as { message?: unknown }).message === 'string'
          && /Cannot POST.*\/gis\/spatial-query/i.test((err.response.data as { message: string }).message))
      );
      if (routeMissing) {
        let features = layerFeatures[analysisTargetLayerId] ?? [];
        if (!features.length) {
          const loaded = await loadLayerFeatures(analysisTargetLayerId);
          features = loaded.features;
          setLayerFeatures((prev) => ({ ...prev, [analysisTargetLayerId]: features }));
        }
        const local = runClientSpatialQuery(
          features,
          spatialOperation,
          geometry,
          analysisTargetLayerId,
          targetLayer?.name ?? 'Layer',
          targetLayer?.name ?? 'Layer',
          targetLayer?.sourceConfig.geometryType ?? 'Point',
          bufferMeters,
        );
        const normalized = local.features
          .map(normalizeMapFeature)
          .filter((feature): feature is GeoFeature => feature !== null);
        setAnalysisResults(normalized);
        setAnalysisMeta(local.meta);
        if (normalized.length === 1) {
          setAnalysisSelectedFeatureId(String(normalized[0].id ?? ''));
        } else {
          setAnalysisSelectedFeatureId(null);
        }
      } else {
        setMapError(formatApiError(err, 'Spatial analysis failed.'));
        setAnalysisResults([]);
        setAnalysisMeta(null);
      }
    } finally {
      setAnalysisLoading(false);
      if (!layerVisibility[analysisTargetLayerId]) {
        setLayerVisibility((prev) => ({ ...prev, [analysisTargetLayerId]: true }));
      }
    }
  }, [
    analysisTargetLayerId,
    assertGeometryInJurisdiction,
    bufferMeters,
    featureClassLayers,
    layerFeatures,
    layerVisibility,
    queryGeometry,
    spatialOperation,
  ]);

  const handleAnalyzeDrawComplete = useCallback((geometry: GeoFeature['geometry']) => {
    if (!geometry) return;
    if (!assertGeometryInJurisdiction(geometry)) {
      setMapError(OUTSIDE_JURISDICTION_MESSAGE);
      return;
    }
    const nextGeometry = geometry as object;
    setQueryGeometry(nextGeometry);
    void runSpatialAnalysis(nextGeometry);
  }, [assertGeometryInJurisdiction, runSpatialAnalysis]);

  useEffect(() => {
    if (analysisTargetLayerId) return;
    const preferred = activeEditLayerId || featureClassLayers[0]?.id || '';
    if (preferred) setAnalysisTargetLayerId(preferred);
  }, [analysisTargetLayerId, activeEditLayerId, featureClassLayers]);

  const analyzeDrawType = useMemo(
    () => SPATIAL_OPERATIONS.find((item) => item.value === spatialOperation)?.drawType ?? 'Polygon',
    [spatialOperation],
  );

  const measureLabel = useMemo(() => {
    if (activeTool === 'measureArea') return 'Area';
    if (activeTool === 'measure') return 'Distance';
    return 'Distance';
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'analyze' || !analysisTargetLayerId) {
      setAnalysisFeatureClass(null);
      return;
    }

    const layer = featureClassLayers.find((item) => item.id === analysisTargetLayerId);
    const { projectId, featureClassId } = layer?.sourceConfig ?? {};
    if (!projectId || !featureClassId) {
      setAnalysisFeatureClass(null);
      return;
    }

    setAnalysisClassLoading(true);
    featureClassesApi.get(projectId, featureClassId)
      .then((response) => setAnalysisFeatureClass(response.data))
      .catch(() => setAnalysisFeatureClass(null))
      .finally(() => setAnalysisClassLoading(false));
  }, [activeTool, analysisTargetLayerId, featureClassLayers]);

  const analysisTableFeatures = useMemo(() => {
    if (!analysisFeatureClass) return [];
    return geoFeaturesToTableRecords(analysisResults, analysisFeatureClass);
  }, [analysisResults, analysisFeatureClass]);

  const analysisPanelSubtitle = useMemo(() => {
    if (!analysisFeatureClass) return undefined;
    const opLabel = SPATIAL_OPERATIONS.find((item) => item.value === spatialOperation)?.label ?? 'Analysis';
    if (analysisMeta) {
      return `${opLabel} on ${analysisMeta.layerName} · ${analysisMeta.count} result${analysisMeta.count === 1 ? '' : 's'}`;
    }
    return `${analysisFeatureClass.geometryType} layer · ${opLabel} · draw on map and run analysis`;
  }, [analysisFeatureClass, analysisMeta, spatialOperation]);

  const handleAnalysisFeatureSelect = useCallback((featureId: string) => {
    setAnalysisSelectedFeatureId(featureId);
    setFocusFeature((prev) => ({
      featureId,
      revision: (prev?.revision ?? 0) + 1,
    }));
  }, []);

  const requestMapSnapshot = useCallback(() => {
    setSnapshotRequest((revision) => revision + 1);
  }, []);

  const clearIdentify = useCallback(() => {
    setInfoSelectedFeatureId(null);
    setInfoSelectedLayerId('');
    setInfoClickProperties(null);
    setInfoDialogOpen(false);
  }, []);

  const handleFeatureIdentify = useCallback((pick: {
    featureId: string;
    layerId: string;
    properties: Record<string, unknown>;
  }) => {
    setInfoSelectedFeatureId(pick.featureId);
    setInfoSelectedLayerId(pick.layerId);
    setSelectedFeatureId(pick.featureId);
    setInfoClickProperties(pick.properties);
    setInfoDialogOpen(true);
    if (!layerVisibility[pick.layerId]) {
      setLayerVisibility((prev) => ({ ...prev, [pick.layerId]: true }));
    }
    if (pick.layerId !== activeEditLayerId) {
      setActiveEditLayerId(pick.layerId);
    }
    requestMapSnapshot();
  }, [activeEditLayerId, layerVisibility, requestMapSnapshot]);

  const saveIdentifyImage = useCallback(async (imageValue: string) => {
    if (!editFeatureClass || !infoSelectedFeatureId || !activeEditLayer) return;

    const fromTable = tableFeatures.find((item) => item.id === infoSelectedFeatureId);
    const currentAttributes = fromTable
      ? fromTable.properties.attributes
      : mapClickPropertiesToAttributes(infoClickProperties ?? {});

    const fieldName = resolveFeatureImageFieldName(editFeatureClass.attributeSchema);
    setImageSaving(true);
    setMapError('');
    try {
      await featureClassesApi.updateFeature(editFeatureClass.projectId, infoSelectedFeatureId, {
        attributes: { ...currentAttributes, [fieldName]: imageValue },
      });
      await Promise.all([
        refreshMapLayerFeatures(activeEditLayer.id),
        refreshEditLayerData(activeEditLayer),
      ]);
    } catch (err) {
      setMapError(formatApiError(err, 'Failed to save feature image.'));
    } finally {
      setImageSaving(false);
    }
  }, [
    editFeatureClass,
    infoSelectedFeatureId,
    activeEditLayer,
    tableFeatures,
    infoClickProperties,
    refreshMapLayerFeatures,
    refreshEditLayerData,
  ]);

  const clearIdentifyImage = useCallback(async () => {
    await saveIdentifyImage('');
  }, [saveIdentifyImage]);

  const handleLocationSelect = (result: GeocodeResult) => {
    if (mapAccess && !mapAccess.canViewAllDivisions && mapAccess.bbox) {
      const [minLon, minLat, maxLon, maxLat] = mapAccess.bbox;
      if (result.lon < minLon || result.lon > maxLon || result.lat < minLat || result.lat > maxLat) {
        setMapError('That location is outside your authorized jurisdiction.');
        return;
      }
    }
    setFlyToTarget((prev) => ({
      lon: result.lon,
      lat: result.lat,
      bbox: result.bbox,
      placeType: result.placeType,
      showMarker: true,
      revision: (prev?.revision ?? 0) + 1,
    }));
  };

  const handleDigitizeComplete = useCallback((geometry: GeoFeature['geometry']) => {
    if (!geometry) return;
    if (!assertGeometryInJurisdiction(geometry)) {
      setMapError(OUTSIDE_JURISDICTION_MESSAGE);
      return;
    }
    setPendingGeometry(geometry as object);
    setDigitizeError('');
    setDigitizeDialogOpen(true);
  }, [assertGeometryInJurisdiction]);

  const handleFeaturePick = useCallback((pick: { featureId: string; layerId: string } | null) => {
    if (!pick) {
      if (!geometryDirty) setSelectedFeatureId(null);
      return;
    }
    setSelectedFeatureId(pick.featureId);
  }, [geometryDirty]);

  const handleGeometryModified = useCallback(async (
    pick: { featureId: string; layerId: string; geometry: GeoFeature['geometry'] },
  ) => {
    if (!pick.geometry || !editFeatureClass) return;
    if (!assertGeometryInJurisdiction(pick.geometry)) {
      setMapError(OUTSIDE_JURISDICTION_MESSAGE);
      return;
    }
    setSelectedFeatureId(pick.featureId);
    setMapError('');

    // When a point is moved, capture the new lon/lat into any latitude/longitude
    // attribute fields so the table stays in sync with the geometry.
    let attributesPayload: Record<string, unknown> | undefined;
    if (
      pick.geometry.type === 'Point'
      && Array.isArray(pick.geometry.coordinates)
    ) {
      const { latField, lonField } = findCoordinateFields(editFeatureClass.attributeSchema);
      if (latField || lonField) {
        const [lon, lat] = pick.geometry.coordinates as number[];
        const currentAttributes = tableFeatures.find((feature) => feature.id === pick.featureId)
          ?.properties.attributes ?? {};
        attributesPayload = { ...currentAttributes };
        if (lonField && Number.isFinite(lon)) {
          attributesPayload[lonField.name] = coordinateValueForField(lonField, lon);
        }
        if (latField && Number.isFinite(lat)) {
          attributesPayload[latField.name] = coordinateValueForField(latField, lat);
        }
      }
    }

    try {
      await featureClassesApi.updateFeature(editFeatureClass.projectId, pick.featureId, {
        geometry: pick.geometry as object,
        ...(attributesPayload ? { attributes: attributesPayload } : {}),
      });
      setGeometryDirty(false);
      // Patch the cached GeoJSON in place so the map stays in sync without a full
      // reload that would interrupt continued vertex dragging.
      setLayerFeatures((prev) => {
        const current = prev[pick.layerId];
        if (!current) return prev;
        return {
          ...prev,
          [pick.layerId]: current.map((feature) => (
            String(feature.id ?? '') === pick.featureId
              ? { ...feature, geometry: pick.geometry as GeoFeature['geometry'] }
              : feature
          )),
        };
      });
      if (activeEditLayer) void refreshEditLayerData(activeEditLayer);
    } catch (err) {
      setGeometryDirty(true);
      setMapError(formatApiError(err, 'Could not save the shape. Adjust the geometry to retry.'));
    }
  }, [editFeatureClass, activeEditLayer, refreshEditLayerData, tableFeatures, assertGeometryInJurisdiction]);

  const handleTableFeatureSelect = useCallback((featureId: string) => {
    setSelectedFeatureId(featureId);
    setFocusFeature((prev) => ({
      featureId,
      revision: (prev?.featureId === featureId ? prev.revision : 0) + 1,
    }));
    if (activeTool !== 'edit') setActiveTool('edit');
  }, [activeTool]);

  const selectedTableFeature = useMemo(
    () => tableFeatures.find((feature) => feature.id === selectedFeatureId) ?? null,
    [tableFeatures, selectedFeatureId],
  );

  const identifiedFeature = useMemo((): ProjectFeatureRecord | null => {
    if (!infoSelectedFeatureId) return null;

    const fromTable = tableFeatures.find((feature) => feature.id === infoSelectedFeatureId);
    if (fromTable) return fromTable;

    if (!infoClickProperties) return null;

    return {
      type: 'Feature',
      id: infoSelectedFeatureId,
      geometry: null,
      properties: {
        featureClassId: editFeatureClass?.id ?? '',
        featureClassCode: editFeatureClass?.code ?? '',
        featureClassName: editFeatureClass?.name ?? String(infoClickProperties.featureClassName ?? ''),
        geometryType: editFeatureClass?.geometryType ?? String(infoClickProperties.geometryType ?? 'Polygon'),
        attributes: mapClickPropertiesToAttributes(infoClickProperties),
        createdAt: '',
        updatedAt: '',
      },
    };
  }, [tableFeatures, infoSelectedFeatureId, infoClickProperties, editFeatureClass]);

  const saveDigitizedFeature = async (attributes: Record<string, unknown>) => {
    const projectId = editFeatureClass?.projectId ?? activeEditLayer?.sourceConfig.projectId;
    const classId = editFeatureClass?.id ?? activeEditLayer?.sourceConfig.featureClassId;
    if (!activeEditLayer || !pendingGeometry || !projectId || !classId) return;

    setSavingDigitize(true);
    setDigitizeError('');
    try {
      await featureClassesApi.createFeature(
        projectId,
        classId,
        { geometry: pendingGeometry, attributes },
      );
      setDigitizeDialogOpen(false);
      setPendingGeometry(null);
      await Promise.all([
        refreshMapLayerFeatures(activeEditLayer.id),
        refreshEditLayerData(activeEditLayer),
      ]);
      setActiveTool(activeTool === 'polygon' ? 'polygon' : 'digitize');
    } catch (err) {
      setDigitizeError(formatApiError(err, 'Failed to save digitized feature.'));
    } finally {
      setSavingDigitize(false);
    }
  };

  const superAdminViewOnly = isSuperAdmin(user?.roles);
  const canDigitize = !superAdminViewOnly && Boolean(activeEditLayer && layerVisibility[activeEditLayer.id]);
  const canDrawPolygon = canDigitize && isMixedLayer;
  const showDigitizeTool = canDigitize;
  const canEdit = canDigitize;
  const canAnalyze = featureClassLayers.length > 0;

  const canDeleteFeature = !superAdminViewOnly && (
    canPerformOperational(user?.roles, hasPermission, 'layer:delete')
    || canPerformOperational(user?.roles, hasPermission, 'layer:update')
    || canPerformOperational(user?.roles, hasPermission, 'project:delete')
    || canPerformOperational(user?.roles, hasPermission, 'project:update')
  );

  const [deletingFeatureId, setDeletingFeatureId] = useState<string | null>(null);

  const handleDeleteFeature = useCallback(async (featureId: string) => {
    const layer = activeEditLayer
      ?? visibleFeatureClassLayers.find((item) => item.id === activeEditLayerId)
      ?? visibleFeatureClassLayers[0];
    const projectId = editFeatureClass?.projectId ?? layer?.sourceConfig.projectId;
    const layerId = layer?.id ?? activeEditLayerId;

    if (!layerId || !projectId) {
      setMapError('Cannot delete feature — layer project is not available.');
      return;
    }
    if (!featureId) return;
    if (!window.confirm('Delete this feature permanently?')) return;

    setMapError('');
    setDeletingFeatureId(featureId);
    try {
      await featureClassesApi.removeFeature(projectId, featureId);
      setSelectedFeatureId(null);
      setInfoSelectedFeatureId(null);
      setGeometryDirty(false);
      await Promise.all([
        refreshMapLayerFeatures(layerId),
        refreshEditLayerData(layer),
      ]);
    } catch (err) {
      setMapError(formatApiError(err, 'Failed to delete feature.'));
    } finally {
      setDeletingFeatureId(null);
    }
  }, [
    activeEditLayer,
    visibleFeatureClassLayers,
    activeEditLayerId,
    editFeatureClass,
    refreshMapLayerFeatures,
    refreshEditLayerData,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      const deleteTargetId = activeTool === 'info' ? infoSelectedFeatureId : selectedFeatureId;
      if (!deleteTargetId || !canDeleteFeature) return;
      if (activeTool !== 'edit' && activeTool !== 'info') return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      event.preventDefault();
      void handleDeleteFeature(deleteTargetId);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, selectedFeatureId, infoSelectedFeatureId, canDeleteFeature, handleDeleteFeature]);

  const exportLayers = useMemo(
    () => buildVisibleExportLayers(
      featureClassLayers.map((layer) => ({ id: layer.id, name: layer.name })),
      layerVisibility,
      layerFeatures,
    ),
    [featureClassLayers, layerVisibility, layerFeatures],
  );

  const exportLegend = useMemo(
    () => exportLayers.map((layer) => {
      const catalogLayer = featureClassLayers.find((item) => item.id === layer.layerId);
      const stroke = catalogLayer ? (layerStyle(catalogLayer).stroke as string) : '#E53935';
      return { name: layer.layerName, color: stroke };
    }),
    [exportLayers, featureClassLayers],
  );

  const logMapExport = useCallback((format: string, details?: Record<string, unknown>) => {
    void gisApi.mapAudit({
      action: 'map_export',
      details: {
        format,
        jurisdiction: mapAccess?.jurisdictionLabel,
        divisionId: effectiveDivisionId || mapAccess?.activeDivisionId || undefined,
        ...details,
      },
    }).catch(() => undefined);
  }, [mapAccess?.jurisdictionLabel, mapAccess?.activeDivisionId, effectiveDivisionId]);

  const handleMapSnapshot = useCallback((result: MapSnapshotResult) => {
    setInfoSnapshot(result.dataUrl);
    const action = pendingExportRef.current;
    if (!action) return;

    pendingExportRef.current = null;

    if (!result.dataUrl) {
      setMapError(
        'Map capture failed. Try the Blank or OpenStreetMap basemap, ensure layers are visible, then export again.',
      );
      return;
    }

    const layerSummary = exportLayers.map((layer) => layer.layerName).join(', ') || 'Current map view';
    const basemapNote = result.basemapOmitted ? ' · Basemap not included (use OSM/Blank for full map)' : '';

    const layoutOptions = {
      title: 'EGIP Map Export',
      subtitle: `WGS 84 · ${layerSummary}${basemapNote}`,
      legend: exportLegend,
    };

    void (async () => {
      try {
        if (action === 'a4-png') {
          await exportMapLayoutPng(result.dataUrl!, { ...layoutOptions, pageSize: 'A4' });
        } else if (action === 'a3-png') {
          await exportMapLayoutPng(result.dataUrl!, { ...layoutOptions, pageSize: 'A3' });
        } else if (action === 'a4-pdf') {
          await exportMapLayoutPdf(result.dataUrl!, { ...layoutOptions, pageSize: 'A4' });
        } else if (action === 'a3-pdf') {
          await exportMapLayoutPdf(result.dataUrl!, { ...layoutOptions, pageSize: 'A3' });
        }
        logMapExport(action, { layerSummary });
      } catch (err) {
        setMapError(err instanceof Error ? err.message : 'Map layout export failed.');
      }
    })();
  }, [exportLayers, exportLegend, logMapExport]);

  const handleMapExport = useCallback((action: MapExportAction) => {
    setMapError('');
    try {
      if (action === 'kml') {
        exportVisibleLayersToKml(exportLayers);
        logMapExport('kml', { layerCount: exportLayers.length });
        return;
      }
      if (action === 'shp') {
        exportVisibleLayersToShapefile(exportLayers);
        logMapExport('shp', { layerCount: exportLayers.length });
        return;
      }
      pendingExportRef.current = action;
      setSnapshotRequest((value) => value + 1);
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'Map export failed.');
    }
  }, [exportLayers, logMapExport]);

  const handleToggleExplorer = useCallback((open: boolean) => {
    setExplorerOpen(open);
    setMapLayoutRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    setMapLayoutRevision((value) => value + 1);
  }, [attributeDockVisible, activeTool]);

  return (
    <Box sx={arcMapShellSx()}>
      <Box sx={mapMapHeaderBarSx()}>
        <Box flexShrink={0} minWidth={0} maxWidth={{ xs: 130, sm: 200, md: 240 }}>
          <Typography variant="caption" sx={{ opacity: 0.85, letterSpacing: '0.06em', fontSize: '0.65rem', display: 'block' }}>
            Map Explorer
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {mapAccess?.jurisdictionLabel ?? 'Enterprise GIS'}
          </Typography>
        </Box>

        <Box flex={1} minWidth={0} />

        <Box display="flex" alignItems="center" gap={0.75} flexShrink={0}>
          {mapReady && !focusLayerBlocked && !waitingForImportView && (
            <MapLocationSearch
              placement="titleBar"
              onSelect={handleLocationSelect}
              searchBbox={mapAccess?.bbox}
            />
          )}
          <Typography variant="caption" sx={{ opacity: 0.85, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {visibleLayerCount} layers · {totalFeatures} features
          </Typography>
        </Box>
      </Box>

      {!focusLayerBlocked && !waitingForImportView && (
        <Box sx={arcMapToolbarSx()}>
          <MapFloatingToolbar
            placement="arcDesktop"
            activeTool={activeTool}
            onToolChange={(tool) => {
              setActiveTool(tool);
              if (tool === 'polygon') setDigitizeShape('Polygon');
              setMeasureResult('');
              clearIdentify();
              if (tool !== 'analyze') {
                clearAnalysis();
              }
              if (tool === 'analyze' && !analysisTargetLayerId) {
                setAnalysisTargetLayerId(activeEditLayerId || featureClassLayers[0]?.id || '');
              }
              if (tool !== 'edit' && !geometryDirty) {
                setSelectedFeatureId(null);
              }
            }}
            measureResult={measureResult}
            measureLabel={measureLabel}
            digitizeGeometryType={digitizeGeometryType}
            canDigitize={canDigitize}
            canDrawPolygon={canDrawPolygon}
            canEdit={canEdit}
            canAnalyze={canAnalyze}
            mixedDigitize={isMixedLayer}
            showDigitizeTool={showDigitizeTool}
            digitizeShape={digitizeShape}
            onDigitizeShapeChange={setDigitizeShape}
            onExport={handleMapExport}
            exportDisabled={false}
            explorerOpen={explorerOpen}
            onShowExplorer={() => handleToggleExplorer(true)}
            selectedFeatureId={selectedFeatureId}
            canDeleteFeature={canDeleteFeature}
            deletingFeatureId={deletingFeatureId}
            onDeleteFeature={canDeleteFeature ? handleDeleteFeature : undefined}
          />
        </Box>
      )}

      <Box display="flex" flex={1} minHeight={0}>
        {explorerOpen && (
          <MapLayerPanel
            groups={explorerLayers}
            layerVisibility={layerVisibility}
            activeBasemapId={activeBasemapId}
            activeBasemapName={activeBasemapName}
            activeEditLayerId={activeEditLayerId}
            featureCount={totalFeatures}
            visibleLayerCount={visibleLayerCount}
            jurisdictionLabel={mapAccess?.jurisdictionLabel}
            onToggleLayer={toggleLayer}
            onToggleGroupLayers={toggleGroupLayers}
            onToggleAllLayers={toggleAllLayers}
            onSelectEditLayer={selectEditLayer}
            onHide={() => handleToggleExplorer(false)}
            onConfigureOrthomosaic={() => setOrthoDialogOpen(true)}
          />
        )}

        <OrthomosaicBasemapDialog
          open={orthoDialogOpen}
          projects={mapProjectOptions}
          defaultProjectId={defaultOrthoProjectId}
          onClose={() => setOrthoDialogOpen(false)}
          onSubmitUrl={handleOrthomosaicSubmit}
          onUploadFile={handleOrthomosaicUpload}
          onRemove={handleOrthomosaicRemove}
        />

        <Box flex={1} display="flex" flexDirection="column" minWidth={0} minHeight={0} bgcolor={MAP_CHROME.pageBg}>
          <Box flex={1} display="flex" minHeight={0} minWidth={0}>
            <Box flex={1} display="flex" flexDirection="column" minWidth={0} minHeight={0}>
          <Box flex={1} position="relative" minHeight={0} sx={mapMapFrameSx(attributeDockVisible)}>
          {mapError && (
            <Alert
              severity="error"
              onClose={() => setMapError('')}
              sx={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                maxWidth: 480,
                width: '90%',
              }}
            >
              {mapError}
            </Alert>
          )}

          {!mapReady && loading ? (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography color="text.secondary">Loading map…</Typography>
            </Box>
          ) : focusLayerBlocked ? (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%" px={3}>
              <Alert severity="warning" sx={{ maxWidth: 560 }}>
                {layerJurisdiction[focusLayerId]?.message ?? OUTSIDE_DISTRICT_LAYER_MESSAGE}
              </Alert>
            </Box>
          ) : waitingForImportView ? (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
              <Typography color="text.secondary">Loading imported boundary…</Typography>
            </Box>
          ) : (
            <>
              <MapViewer
                basemaps={basemaps}
                activeBasemapId={activeBasemapId}
                overlayLayers={overlayLayers}
                fitToLayerId={mapFitLayerId}
                fitRevision={fitRequestId}
                flyToTarget={flyToTarget}
                jurisdictionBbox={mapAccess?.bbox ?? UTTARAKHAND_STATE_MAP_VIEW.bbox}
                jurisdictionRevision={jurisdictionRevision}
                jurisdictionBboxKey={jurisdictionBboxKey}
                center={mapCenter}
                zoom={mapZoom}
                activeTool={activeTool}
                onMeasureResult={setMeasureResult}
                digitizeGeometryType={digitizeGeometryType}
                onDigitizeComplete={handleDigitizeComplete}
                analyzeDrawType={analyzeDrawType}
                onAnalyzeDrawComplete={handleAnalyzeDrawComplete}
                clearQueryRevision={clearQueryRevision}
                editLayerId={
                  activeTool === 'edit'
                    ? activeEditLayerId
                    : activeTool === 'analyze'
                      ? analysisTargetLayerId
                      : undefined
                }
                selectedFeatureId={selectedFeatureId}
                focusFeature={focusFeature}
                onFeaturePick={handleFeaturePick}
                onGeometryModified={handleGeometryModified}
                onFeatureIdentify={handleFeatureIdentify}
                onIdentifyClear={clearIdentify}
                identifyFeatureId={activeTool === 'info' ? infoSelectedFeatureId : null}
                identifyLayerId={activeTool === 'info' ? infoSelectedLayerId : undefined}
                snapshotRequest={snapshotRequest}
                layoutRevision={mapLayoutRevision + (mapReady ? 1 : 0)}
                onSnapshot={handleMapSnapshot}
              />
              <MapInfoDialog
                open={infoDialogOpen && Boolean(infoSelectedFeatureId)}
                loading={!identifiedFeature && tableLoading}
                savingImage={imageSaving}
                layerName={editFeatureClass?.name}
                featureClass={editFeatureClass}
                feature={identifiedFeature}
                mapSnapshot={infoSnapshot}
                onClose={clearIdentify}
                onImageChange={(value) => { void saveIdentifyImage(value); }}
                onImageClear={() => { void clearIdentifyImage(); }}
              />
            </>
          )}
          </Box>
            </Box>

            <MapSpatialAnalysisPanel
              open={activeTool === 'analyze'}
              active
              layers={featureClassLayers.map((layer) => ({
                id: layer.id,
                name: layer.name,
                geometryType: layer.sourceConfig.geometryType,
              }))}
              targetLayerId={analysisTargetLayerId}
              operation={spatialOperation}
              bufferMeters={bufferMeters}
              loading={analysisLoading}
              meta={analysisMeta}
              hasQueryGeometry={Boolean(queryGeometry)}
              onTargetLayerChange={setAnalysisTargetLayerId}
              onOperationChange={(operation) => {
                setSpatialOperation(operation);
                clearAnalysis();
              }}
              onBufferMetersChange={setBufferMeters}
              onRun={() => { void runSpatialAnalysis(); }}
              onClear={clearAnalysis}
              onClose={() => setActiveTool('info')}
            />
          </Box>

          {visibleFeatureClassLayers.length > 0 && activeTool !== 'info' && activeTool !== 'analyze' && (
            <MapAttributeSheetBook
              sheets={attributeSheets}
              activeLayerId={activeEditLayerId || visibleFeatureClassLayers[0]?.id || ''}
              onSelectSheet={selectEditLayer}
              digitizeActive={activeTool === 'digitize' || activeTool === 'polygon'}
              editActive={activeTool === 'edit'}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={handleTableFeatureSelect}
              onRefresh={() => {
                if (activeEditLayer) void refreshEditLayerData(activeEditLayer);
              }}
              onDeleteFeature={canDeleteFeature ? handleDeleteFeature : undefined}
              deletingFeatureId={deletingFeatureId}
              onError={setMapError}
            />
          )}

          {analysisFeatureClass && activeTool === 'analyze' && (
            <MapAttributePanel
              featureClass={analysisFeatureClass}
              features={analysisTableFeatures}
              loading={analysisClassLoading || analysisLoading}
              analysisActive
              readOnly
              subtitle={analysisPanelSubtitle}
              selectedFeatureId={analysisSelectedFeatureId}
              onSelectFeature={handleAnalysisFeatureSelect}
              onRefresh={() => {}}
              onError={setMapError}
            />
          )}
        </Box>
      </Box>

      {digitizeDialogOpen && activeEditLayer && (
        <DigitizeAttributeDialog
          open={digitizeDialogOpen}
          layerName={editFeatureClass?.name ?? activeEditLayer.name}
          geometryType={editFeatureClass?.geometryType === 'Any'
            ? (digitizeGeometryType ?? 'Point')
            : (editFeatureClass?.geometryType ?? activeEditLayer.sourceConfig.geometryType ?? 'Point')}
          attributeSchema={editFeatureClass?.attributeSchema ?? []}
          loading={!editFeatureClass && tableLoading}
          error={digitizeError}
          saving={savingDigitize}
          onClose={() => {
            if (savingDigitize) return;
            setDigitizeDialogOpen(false);
            setPendingGeometry(null);
            setDigitizeError('');
          }}
          onSave={saveDigitizedFeature}
        />
      )}

      <ArcMapStatusBar
        segments={[
          <Typography key="jurisdiction" variant="caption" noWrap>
            {mapAccess?.jurisdictionLabel ?? 'Map'}
          </Typography>,
          <Typography key="basemap" variant="caption">
            Basemap: {activeBasemapName ?? '—'}
          </Typography>,
          <Typography key="tool" variant="caption">
            Tool: {activeTool}
          </Typography>,
          <Typography key="layers" variant="caption">
            {visibleLayerCount} visible / {totalFeatures} features
          </Typography>,
        ]}
      />
    </Box>
  );
}
