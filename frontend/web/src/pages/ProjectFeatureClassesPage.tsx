import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, IconButton, InputLabel, MenuItem,
  Select, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography, CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LayersIcon from '@mui/icons-material/Layers';
import MapIcon from '@mui/icons-material/Map';
import TableChartIcon from '@mui/icons-material/TableChart';
import FeatureClassTree, { GEOMETRY_GROUPS, type TreeSelection, nodeId } from '../components/gis/FeatureClassTree';
import SurveyImportDialog from '../components/gis/SurveyImportDialog';
import ImportFeatureClassDialog from '../components/gis/ImportFeatureClassDialog';
import {
  ARCMAP,
  ArcMapStatusBar,
  ArcMapToolbarButton,
  arcMapAttributeHeaderSx,
  arcMapContentFrameSx,
  arcMapListBoxSx,
  arcMapListRowSx,
  arcMapPanelHeaderSx,
  arcMapShellSx,
  arcMapTitleBarSx,
  arcMapToolbarGroupSx,
  arcMapToolbarSx,
  arcMapTocColumnSx,
  arcMapWorkspaceColumnSx,
} from '../components/gis/arcMapUi';
import { formatApiError } from '../utils/apiError';
import { OUTSIDE_DISTRICT_LAYER_MESSAGE } from '../utils/jurisdictionGeometry';
import { importFeaturesInBatches, summarizeImportFailures } from '../utils/featureImport';
import { prepareAttributeSchema, toSnakeCaseIdentifier } from '../utils/fieldName';
import { hasOrthomosaicBasemap } from '../utils/orthomosaicBasemap';
import FeatureImageInput from '../components/shared/FeatureImageInput';
import { parseOptionalGeometry } from '../utils/geometryInput';
import { coordinateFieldNames } from '../utils/coordinateFields';
import {
  ATTRIBUTE_TABLE_INDEX_WIDTH,
  attributeBodyCellSx,
  attributeCellFieldSx,
  attributeHeaderCellWidth,
  attributeTableSx,
  pickFlexibleAttributeField,
} from '../utils/attributeTableStyles';
import {
  AttributeField, FeatureClassRecord, ProjectFeatureRecord,
  featureClassesApi, gisApi, projectsApi,
} from '../services/api';

const FIELD_TYPES: AttributeField['type'][] = ['text', 'number', 'integer', 'boolean', 'date', 'select', 'image'];
const GEOMETRY_TYPES = ['Point', 'LineString', 'Polygon', 'Any'] as const;

const GEOMETRY_TYPE_LABELS: Record<typeof GEOMETRY_TYPES[number], string> = {
  Point: 'Point',
  LineString: 'Line',
  Polygon: 'Polygon',
  Any: 'Any (Point, Line & Polygon)',
};

const emptyField = (): AttributeField => ({
  name: '', label: '', type: 'text', required: false,
});

function getErrorMessage(err: unknown): string {
  return formatApiError(err, 'Request failed.');
}

export default function ProjectFeatureClassesPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [projectDivisionId, setProjectDivisionId] = useState<string | null>(null);
  const [projectHasOrtho, setProjectHasOrtho] = useState(false);
  const [classes, setClasses] = useState<FeatureClassRecord[]>([]);
  const [featuresByClass, setFeaturesByClass] = useState<Record<string, ProjectFeatureRecord[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<TreeSelection | null>({ type: 'project' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importClassDialogOpen, setImportClassDialogOpen] = useState(false);
  const [importClassGeometryType, setImportClassGeometryType] = useState<typeof GEOMETRY_TYPES[number]>('Point');
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const [schemaForm, setSchemaForm] = useState<AttributeField[]>([]);
  const [classForm, setClassForm] = useState({
    code: '',
    name: '',
    description: '',
    geometryType: 'Point' as typeof GEOMETRY_TYPES[number],
    attributeSchema: [emptyField()],
  });
  const [featureForm, setFeatureForm] = useState({
    geometryJson: '',
    latitude: '',
    longitude: '',
    attributes: {} as Record<string, unknown>,
  });
  const [featureDialogError, setFeatureDialogError] = useState('');
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [scaffoldDialogOpen, setScaffoldDialogOpen] = useState(false);
  const [scaffoldingLa, setScaffoldingLa] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState<{ created: number; skipped: number; totalTemplates: number } | null>(null);

  const selectedClass = useMemo(() => {
    if (!selection) return null;
    const classId = 'classId' in selection ? selection.classId : undefined;
    return classId ? classes.find((c) => c.id === classId) ?? null : null;
  }, [selection, classes]);

  const loadClasses = async () => {
    setLoading(true);
    setError('');
    try {
      const [projectRes, classesRes] = await Promise.all([
        projectsApi.get(projectId),
        featureClassesApi.list(projectId),
      ]);
      setProjectName(projectRes.data.name);
      setProjectDivisionId(projectRes.data.divisionId ?? null);
      setProjectHasOrtho(hasOrthomosaicBasemap(projectRes.data.orthomosaicConfig));
      setClasses(classesRes.data);
      const vis: Record<string, boolean> = {};
      classesRes.data.forEach((featureClass) => { vis[featureClass.id] = true; });
      setVisibility(vis);
      setExpanded({ [nodeId('project')]: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadFeatures = useCallback(async (classId: string) => {
    try {
      const res = await featureClassesApi.listFeatures(projectId, classId);
      setFeaturesByClass((prev) => ({ ...prev, [classId]: res.data }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [projectId]);

  useEffect(() => { loadClasses(); }, [projectId]);

  useEffect(() => {
    if (selectedClass && (
      selection?.type === 'feature-class'
      || selection?.type === 'attribute-table'
      || selection?.type === 'features-folder'
      || selection?.type === 'field'
      || selection?.type === 'feature'
    )) {
      void loadFeatures(selectedClass.id);
    }
  }, [selectedClass?.id, selection?.type, loadFeatures]);

  const toggleExpand = (node: string) => {
    setExpanded((prev) => ({ ...prev, [node]: !prev[node] }));
  };

  const openCreateClass = (geometryType?: typeof GEOMETRY_TYPES[number]) => {
    setClassForm({
      code: '', name: '', description: '',
      geometryType: geometryType ?? 'Point',
      attributeSchema: [emptyField()],
    });
    setClassDialogOpen(true);
  };

  const handleScaffoldLaGisLayers = async () => {
    setScaffoldingLa(true);
    setError('');
    setScaffoldResult(null);
    try {
      const res = await featureClassesApi.scaffoldLaGisLayers(projectId);
      setScaffoldResult({
        created: res.data.created,
        skipped: res.data.skipped,
        totalTemplates: res.data.totalTemplates,
      });
      await loadClasses();
      setExpanded({ [nodeId('project')]: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setScaffoldDialogOpen(false);
    } finally {
      setScaffoldingLa(false);
    }
  };

  const openImportClass = (geometryType: typeof GEOMETRY_TYPES[number]) => {
    setImportClassGeometryType(geometryType);
    setImportClassDialogOpen(true);
  };

  const convertClassToMixed = async (classId: string) => {
    if (!window.confirm(
      'Allow this layer to hold Point, Line and Polygon features?\n\n'
      + 'Existing features stay as they are; you will then be able to digitize all '
      + 'geometry types on this layer. This cannot be reversed.',
    )) return;
    setError('');
    try {
      await featureClassesApi.update(projectId, classId, { geometryType: 'Any' });
      await loadClasses();
      setExpanded((prev) => ({
        ...prev,
        [nodeId('group', 'Any')]: true,
        [nodeId('class', classId)]: true,
      }));
      setSelection({ type: 'feature-class', classId });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleImportedClassCreated = async (classId: string, geometryType: string) => {
    await loadClasses();
    setExpanded((prev) => ({
      ...prev,
      [nodeId('project')]: true,
      [nodeId('group', geometryType)]: true,
      [nodeId('class', classId)]: true,
    }));
    setSelection({ type: 'feature-class', classId });
    await loadFeatures(classId);
  };

  const mapBasemapQuery = (geometryType: string) => {
    if (projectHasOrtho) return '&basemap=ortho';
    return geometryType === 'Polygon' ? '&basemap=google' : '';
  };

  const mapScopeQuery = () => {
    const params = new URLSearchParams();
    if (projectDivisionId) params.set('division', projectDivisionId);
    params.set('project', projectId);
    return params.toString();
  };

  const navigateToMapLayer = async (layerId: string, geometryType: string) => {
    try {
      const access = await gisApi.checkLayerJurisdiction(layerId);
      if (!access.allowed) {
        setError(access.message ?? OUTSIDE_DISTRICT_LAYER_MESSAGE);
        return;
      }
      navigate(`/map?layer=${layerId}&fit=1&${mapScopeQuery()}${mapBasemapQuery(geometryType)}&t=${Date.now()}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const openMapExplorer = () => {
    navigate(`/map?fit=1&${mapScopeQuery()}&t=${Date.now()}`);
  };

  const openSelectedLayerOnMap = () => {
    if (!selectedClass) {
      openMapExplorer();
      return;
    }
    void (async () => {
      const layersRes = await gisApi.layers();
      const catalog = layersRes.data as Array<{ layers: Array<{ id: string; sourceType: string; sourceConfig?: { featureClassId?: string } }> }>;
      const mapLayer = catalog
        .flatMap((group) => group.layers)
        .find(
          (layer) => layer.sourceType === 'project_feature_class'
            && layer.sourceConfig?.featureClassId === selectedClass.id,
        );
      if (mapLayer) {
        await navigateToMapLayer(mapLayer.id, selectedClass.geometryType);
      } else {
        openMapExplorer();
      }
    })();
  };

  const updateField = (index: number, patch: Partial<AttributeField>) => {
    setClassForm((prev) => ({
      ...prev,
      attributeSchema: prev.attributeSchema.map((field, i) => (
        i === index ? { ...field, ...patch } : field
      )),
    }));
  };

  const addField = () => {
    setClassForm((prev) => ({
      ...prev,
      attributeSchema: [...prev.attributeSchema, emptyField()],
    }));
  };

  const removeField = (index: number) => {
    setClassForm((prev) => ({
      ...prev,
      attributeSchema: prev.attributeSchema.filter((_, i) => i !== index),
    }));
  };

  const updateSchemaField = (index: number, patch: Partial<AttributeField>) => {
    setSchemaForm((prev) => prev.map((field, i) => (
      i === index ? { ...field, ...patch } : field
    )));
  };

  const addSchemaField = () => {
    setSchemaForm((prev) => [...prev, emptyField()]);
  };

  const removeSchemaField = (index: number) => {
    setSchemaForm((prev) => prev.filter((_, i) => i !== index));
  };

  const openSchemaEditor = () => {
    if (!selectedClass) return;
    setSchemaForm(
      selectedClass.attributeSchema.length
        ? selectedClass.attributeSchema.map((field) => ({ ...field }))
        : [emptyField()],
    );
    setSchemaDialogOpen(true);
  };

  const saveSchema = async () => {
    if (!selectedClass) return;
    try {
      const attributeSchema = prepareAttributeSchema(schemaForm);
      if (!attributeSchema.length) {
        setError('Add at least one column with a label.');
        return;
      }
      await featureClassesApi.update(projectId, selectedClass.id, { attributeSchema });
      setSchemaDialogOpen(false);
      await loadClasses();
      await loadFeatures(selectedClass.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const saveClass = async () => {
    try {
      const attributeSchema = prepareAttributeSchema(classForm.attributeSchema);
      if (!classForm.name.trim()) {
        setError('Feature class name is required.');
        return;
      }
      const payload = {
        ...classForm,
        code: toSnakeCaseIdentifier(classForm.code || classForm.name, 'layer'),
        name: classForm.name.trim(),
        attributeSchema,
      };
      const res = await featureClassesApi.create(projectId, payload);
      setClassDialogOpen(false);
      await loadClasses();
      setExpanded((prev) => ({
        ...prev,
        [nodeId('project')]: true,
        [nodeId('group', res.data.geometryType)]: true,
        [nodeId('class', res.data.id)]: true,
      }));
      setSelection({ type: 'feature-class', classId: res.data.id });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const openCreateFeature = () => {
    if (!selectedClass) return;
    const attrs: Record<string, unknown> = {};
    selectedClass.attributeSchema.forEach((field) => {
      attrs[field.name] = field.type === 'boolean' ? false : '';
    });
    setFeatureForm({ geometryJson: '', latitude: '', longitude: '', attributes: attrs });
    setFeatureDialogError('');
    setFeatureDialogOpen(true);
  };

  const coerceAttributeValue = (field: AttributeField, raw: string) => {
    if (field.type === 'number' || field.type === 'integer') return Number(raw);
    if (field.type === 'boolean') return raw === 'true';
    return raw;
  };

  const saveFeatureAttributes = async (
    featureId: string,
    currentAttributes: Record<string, unknown>,
    field: AttributeField,
    rawValue: string,
  ) => {
    if (!selectedClass) return;
    const cellKey = `${featureId}:${field.name}`;
    const nextValue = coerceAttributeValue(field, rawValue);
    const currentValue = currentAttributes[field.name];
    if (String(currentValue ?? '') === String(nextValue ?? '')) return;

    setSavingCell(cellKey);
    setError('');
    try {
      const attributes = {
        ...currentAttributes,
        [field.name]: nextValue,
      };
      await featureClassesApi.updateFeature(projectId, featureId, { attributes });
      await loadFeatures(selectedClass.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingCell(null);
    }
  };

  const importSurveyFeatures = async (
    features: Array<{ geometry: object; attributes: Record<string, unknown> }>,
  ) => {
    if (!selectedClass) return;
    const batchSize = selectedClass.geometryType === 'Polygon' ? 1 : 10;
    const result = await importFeaturesInBatches(projectId, selectedClass.id, features, batchSize);
    if (result.failed?.length) {
      const detail = summarizeImportFailures(result.failed);
      setError(
        `Imported ${result.imported} features. ${result.failed.length} skipped${detail ? `: ${detail}` : ''}.`,
      );
    }

    await Promise.all([
      loadFeatures(selectedClass.id),
      loadClasses(),
    ]);

    const layersRes = await gisApi.layers();
    const catalog = layersRes.data as Array<{ layers: Array<{ id: string; sourceType: string; sourceConfig?: { featureClassId?: string } }> }>;
    const mapLayer = catalog
      .flatMap((group) => group.layers)
      .find(
        (layer) => layer.sourceType === 'project_feature_class'
          && layer.sourceConfig?.featureClassId === selectedClass.id,
      );

    const timestamp = Date.now();
    const basemapQuery = mapBasemapQuery(selectedClass.geometryType);
    if (mapLayer) {
      const access = await gisApi.checkLayerJurisdiction(mapLayer.id);
      if (!access.allowed) {
        setError(access.message ?? OUTSIDE_DISTRICT_LAYER_MESSAGE);
        return;
      }
      navigate(`/map?layer=${mapLayer.id}&fit=1&${mapScopeQuery()}${basemapQuery}&t=${timestamp}`);
    } else {
      navigate(`/map?fit=1&${mapScopeQuery()}${basemapQuery}&t=${timestamp}`);
    }
  };

  const saveFeature = async () => {
    if (!selectedClass) return;
    setFeatureDialogError('');
    try {
      const payload: { attributes: Record<string, unknown>; geometry?: object } = {
        attributes: featureForm.attributes,
      };
      const geometry = parseOptionalGeometry(
        selectedClass.geometryType,
        featureForm.geometryJson,
        featureForm.latitude,
        featureForm.longitude,
      );
      if (geometry) payload.geometry = geometry;
      await featureClassesApi.createFeature(projectId, selectedClass.id, payload);
      setFeatureDialogOpen(false);
      await loadFeatures(selectedClass.id);
      await loadClasses();
      setExpanded((prev) => ({
        ...prev,
        [nodeId('features', selectedClass.id)]: true,
      }));
    } catch (err) {
      setFeatureDialogError(getErrorMessage(err));
    }
  };

  const deleteClass = async (classId: string) => {
    if (!window.confirm('Delete this feature class and all its features?')) return;
    try {
      await featureClassesApi.remove(projectId, classId);
      setFeaturesByClass((prev) => {
        const next = { ...prev };
        delete next[classId];
        return next;
      });
      if (selectedClass?.id === classId) setSelection({ type: 'project' });
      await loadClasses();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const renderDetailPanel = () => {
    if (!selection || selection.type === 'project') {
      return (
        <Box p={2}>
          <Box sx={arcMapPanelHeaderSx()}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: ARCMAP.text }}>
              Catalog — {projectName}
            </Typography>
            <Typography variant="caption" sx={{ color: ARCMAP.textMuted }}>
              Select a geometry group to import survey data or create an empty feature class for digitizing.
            </Typography>
          </Box>
          <Box p={2}>
            <Typography variant="caption" fontWeight={700} sx={{ color: ARCMAP.textMuted, mb: 0.75, display: 'block' }}>
              Feature class types
            </Typography>
            <Box sx={arcMapListBoxSx()}>
              {GEOMETRY_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <Box
                    key={group.type}
                    sx={arcMapListRowSx()}
                    onClick={() => {
                      setSelection({ type: 'geometry-group', geometryType: group.type });
                      setExpanded((prev) => ({
                        ...prev,
                        [nodeId('project')]: true,
                        [nodeId('group', group.type)]: true,
                      }));
                    }}
                  >
                    <GroupIcon sx={{ fontSize: 18, color: ARCMAP.accent }} />
                    <Typography variant="body2" fontWeight={600} fontSize="0.8125rem">
                      {group.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      );
    }

    if (selection.type === 'geometry-group') {
      const group = GEOMETRY_GROUPS.find((g) => g.type === selection.geometryType);
      const groupClasses = classes.filter((c) => c.geometryType === selection.geometryType);
      const GroupIcon = group?.icon;
      return (
        <Box>
          <Box sx={arcMapPanelHeaderSx()}>
            <Box display="flex" alignItems="center" gap={1}>
              {GroupIcon ? <GroupIcon sx={{ fontSize: 20, color: ARCMAP.accent }} /> : null}
              <Typography variant="subtitle2" fontWeight={700}>{group?.label}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: ARCMAP.textMuted, mt: 0.5, display: 'block' }}>
              Import a survey file (CSV, KML, SHP) or create an empty layer for manual entry and map digitizing.
            </Typography>
          </Box>
          <Box p={2}>
            <Box sx={arcMapToolbarGroupSx()} display="inline-flex" mb={2}>
              <ArcMapToolbarButton
                title="Import survey file"
                label="Import"
                icon={<UploadFileIcon sx={{ fontSize: 18 }} />}
                onClick={() => openImportClass(selection.geometryType as typeof GEOMETRY_TYPES[number])}
                primary
              />
              <ArcMapToolbarButton
                title="Create empty layer"
                label="New Layer"
                icon={<AddIcon sx={{ fontSize: 18 }} />}
                onClick={() => openCreateClass(selection.geometryType as typeof GEOMETRY_TYPES[number])}
              />
            </Box>
            {groupClasses.length > 0 ? (
              <>
                <Typography variant="caption" fontWeight={700} sx={{ color: ARCMAP.textMuted, mb: 0.75, display: 'block' }}>
                  Layers in this group
                </Typography>
                <Box sx={arcMapListBoxSx()}>
                  {groupClasses.map((featureClass) => (
                    <Box
                      key={featureClass.id}
                      sx={arcMapListRowSx(selectedClass?.id === featureClass.id)}
                      onClick={() => setSelection({ type: 'feature-class', classId: featureClass.id })}
                    >
                      <LayersIcon sx={{ fontSize: 17, color: '#5c6bc0' }} />
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={600} noWrap fontSize="0.8125rem">
                          {featureClass.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {featureClass.featureCount ?? 0} feature(s)
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No layers in this group yet.</Typography>
            )}
          </Box>
        </Box>
      );
    }

    if (!selectedClass) return null;

    const selectedFeatureId = selection.type === 'feature' ? selection.featureId : null;
    const coordFieldNames = coordinateFieldNames(selectedClass.attributeSchema);
    const flexibleFieldName = pickFlexibleAttributeField(
      selectedClass.attributeSchema,
      coordFieldNames,
    )?.name ?? null;

    return (
      <Box display="flex" flexDirection="column" height="100%">
        <Box sx={arcMapPanelHeaderSx()}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} flexWrap="wrap">
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{selectedClass.name}</Typography>
              <Typography variant="caption" sx={{ color: ARCMAP.textMuted }}>
                {selectedClass.geometryType === 'Any' ? 'Mixed (Point / Line / Polygon)' : selectedClass.geometryType}
                {' · '}
                {selectedClass.featureCount ?? 0} feature(s)
              </Typography>
            </Box>
            <Box sx={arcMapToolbarGroupSx()}>
              <ArcMapToolbarButton
                title="Open layer on map"
                label="Map"
                icon={<MapIcon sx={{ fontSize: 18 }} />}
                onClick={openSelectedLayerOnMap}
                primary
              />
              <ArcMapToolbarButton
                title="Edit attribute fields"
                label="Fields"
                icon={<TableChartIcon sx={{ fontSize: 18 }} />}
                onClick={openSchemaEditor}
              />
              {selectedClass.geometryType !== 'Any' && (
                <ArcMapToolbarButton
                  title="Allow all geometry types"
                  label="Mixed"
                  icon={<LayersIcon sx={{ fontSize: 18 }} />}
                  onClick={() => { void convertClassToMixed(selectedClass.id); }}
                />
              )}
              <ArcMapToolbarButton
                title="Import more features"
                label="Import"
                icon={<UploadFileIcon sx={{ fontSize: 18 }} />}
                onClick={() => setImportDialogOpen(true)}
              />
              <ArcMapToolbarButton
                title="Add record"
                label="Add"
                icon={<AddIcon sx={{ fontSize: 18 }} />}
                onClick={openCreateFeature}
              />
            </Box>
          </Box>
        </Box>

        <Box flex={1} overflow="auto" p={1.5}>
        <Typography variant="caption" fontWeight={700} sx={{ color: ARCMAP.textMuted, mb: 0.5, display: 'block' }}>
          Attribute Table
        </Typography>
        <Box sx={{ overflow: 'auto', border: `1px solid ${ARCMAP.toolbarBorder}`, boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.06)' }}>
          <Table size="small" sx={{ border: 0, ...attributeTableSx }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{
                  ...arcMapAttributeHeaderSx(),
                  width: ATTRIBUTE_TABLE_INDEX_WIDTH,
                  maxWidth: ATTRIBUTE_TABLE_INDEX_WIDTH,
                }}
                >
                  #
                </TableCell>
                {selectedClass.attributeSchema.map((field) => (
                  <TableCell
                    key={field.name}
                    sx={{
                      ...arcMapAttributeHeaderSx(),
                      ...attributeHeaderCellWidth(field, coordFieldNames, flexibleFieldName),
                    }}
                  >
                    {field.label}
                  </TableCell>
                ))}
                <TableCell sx={{ ...arcMapAttributeHeaderSx(), width: 72, maxWidth: 72 }}>Geometry</TableCell>
              </TableRow>
            </TableHead>
          <TableBody>
            {selectedClass.attributeSchema.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} align="center" sx={{ py: 1.5, color: 'text.secondary' }}>
                  No attribute fields yet.
                </TableCell>
              </TableRow>
            )}
            {(featuresByClass[selectedClass.id] ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(selectedClass.attributeSchema.length, 1) + 2}
                  align="center"
                  sx={{ py: 3, color: 'text.secondary' }}
                >
                  No records yet.
                </TableCell>
              </TableRow>
            ) : (
              (featuresByClass[selectedClass.id] ?? []).map((feature, index) => (
                <TableRow
                  key={feature.id}
                  hover
                  selected={selectedFeatureId === feature.id}
                  onClick={() => setSelection({
                    type: 'feature', classId: selectedClass.id, featureId: feature.id,
                  })}
                >
                  <TableCell sx={{
                    ...attributeBodyCellSx(
                      { name: '_index', label: '#', type: 'integer', required: false },
                      coordFieldNames,
                    ),
                    width: ATTRIBUTE_TABLE_INDEX_WIDTH,
                    maxWidth: ATTRIBUTE_TABLE_INDEX_WIDTH,
                  }}
                  >
                    {index + 1}
                  </TableCell>
                  {selectedClass.attributeSchema.map((field) => {
                    const cellKey = `${feature.id}:${field.name}`;
                    const value = String(feature.properties.attributes[field.name] ?? '');
                    return (
                      <TableCell
                        key={field.name}
                        onClick={(event) => event.stopPropagation()}
                        sx={attributeBodyCellSx(
                          field,
                          coordFieldNames,
                          field.type === 'image' ? { p: 0.5 } : {},
                          flexibleFieldName,
                        )}
                      >
                        {field.type === 'boolean' ? (
                          <Switch
                            size="small"
                            checked={feature.properties.attributes[field.name] === true}
                            disabled={savingCell === cellKey}
                            onChange={(event) => {
                              void saveFeatureAttributes(
                                feature.id,
                                feature.properties.attributes,
                                field,
                                event.target.checked ? 'true' : 'false',
                              );
                            }}
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            size="small"
                            variant="standard"
                            value={value}
                            disabled={savingCell === cellKey}
                            displayEmpty
                            sx={attributeCellFieldSx}
                            onChange={(event) => {
                              void saveFeatureAttributes(
                                feature.id,
                                feature.properties.attributes,
                                field,
                                String(event.target.value),
                              );
                            }}
                          >
                            <MenuItem value=""><em>—</em></MenuItem>
                            {(field.options ?? []).map((option) => (
                              <MenuItem key={option} value={option}>{option}</MenuItem>
                            ))}
                          </Select>
                        ) : field.type === 'image' ? (
                          <FeatureImageInput
                            compact
                            value={typeof feature.properties.attributes[field.name] === 'string'
                              ? feature.properties.attributes[field.name] as string
                              : null}
                            saving={savingCell === cellKey}
                            onChange={(imageValue) => {
                              void saveFeatureAttributes(
                                feature.id,
                                feature.properties.attributes,
                                field,
                                imageValue,
                              );
                            }}
                            onClear={() => {
                              void saveFeatureAttributes(
                                feature.id,
                                feature.properties.attributes,
                                field,
                                '',
                              );
                            }}
                          />
                        ) : (
                          <TextField
                            key={`${cellKey}-${value}`}
                            size="small"
                            variant="standard"
                            placeholder="—"
                            defaultValue={value}
                            disabled={savingCell === cellKey}
                            sx={attributeCellFieldSx}
                            type={field.type === 'number' || field.type === 'integer' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            onBlur={(event) => {
                              void saveFeatureAttributes(
                                feature.id,
                                feature.properties.attributes,
                                field,
                                event.target.value,
                              );
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                            InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                          />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell sx={{ ...attributeBodyCellSx(
                    { name: '_geom', label: 'Geometry', type: 'text', required: false },
                    coordFieldNames,
                  ), width: 72, maxWidth: 72 }}
                  >
                    {feature.geometry ? 'Yes' : 'No'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </Box>
        </Box>
      </Box>
    );
  };

  const statusLayerLabel = selectedClass?.name
    ?? (selection?.type === 'geometry-group'
      ? GEOMETRY_GROUPS.find((g) => g.type === selection.geometryType)?.label
      : 'Project catalog');

  const statusFeatureCount = selectedClass
    ? (featuresByClass[selectedClass.id]?.length ?? selectedClass.featureCount ?? 0)
    : classes.length;

  if (loading) {
    return (
      <Box sx={{ ...arcMapShellSx(), justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={arcMapShellSx()}>
      <Box sx={arcMapTitleBarSx()}>
        <IconButton size="small" onClick={() => navigate('/projects')} sx={{ color: '#e2e8f0', p: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box flex={1} minWidth={0}>
          <Typography variant="caption" sx={{ opacity: 0.85, letterSpacing: '0.06em', fontSize: '0.65rem' }}>
            Feature Class Catalog
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {projectName}
          </Typography>
        </Box>
      </Box>

      <Box sx={arcMapToolbarSx()}>
        <Box sx={arcMapToolbarGroupSx()}>
          <ArcMapToolbarButton
            title="Back to projects"
            icon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/projects')}
          />
        </Box>
        <Box sx={arcMapToolbarGroupSx()}>
          <ArcMapToolbarButton
            title="Create new layer"
            label="New Layer"
            icon={<AddIcon sx={{ fontSize: 18 }} />}
            onClick={() => openCreateClass()}
          />
          <ArcMapToolbarButton
            title="Create all 44 standard Land Acquisition GIS overlay layers"
            label="LA GIS Layers"
            icon={<LayersIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              setScaffoldResult(null);
              setScaffoldDialogOpen(true);
            }}
          />
          <ArcMapToolbarButton
            title="Open map explorer"
            label="Map"
            icon={<MapIcon sx={{ fontSize: 18 }} />}
            onClick={openMapExplorer}
            primary
          />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mx: 0.75, mt: 0.75, py: 0 }} onClose={() => setError('')}>{error}</Alert>}

      <Box display="flex" flex={1} minHeight={0}>
        <Box sx={arcMapTocColumnSx()}>
          <FeatureClassTree
            projectName={projectName}
            classes={classes}
            featuresByClass={featuresByClass}
            expanded={expanded}
            visibility={visibility}
            selection={selection}
            onToggleExpand={toggleExpand}
            onToggleVisibility={(classId, visible) => setVisibility((prev) => ({ ...prev, [classId]: visible }))}
            onSelect={setSelection}
            onDeleteClass={deleteClass}
            onLoadFeatures={loadFeatures}
          />
        </Box>

        <Box sx={arcMapWorkspaceColumnSx()}>
          <Box sx={arcMapContentFrameSx()}>
            {renderDetailPanel()}
          </Box>
        </Box>
      </Box>

      <ArcMapStatusBar
        segments={[
          <Typography key="layer" variant="caption" noWrap>
            Layer: {statusLayerLabel}
          </Typography>,
          <Typography key="count" variant="caption">
            Features: {statusFeatureCount}
          </Typography>,
          <Typography key="classes" variant="caption">
            Classes: {classes.length}
          </Typography>,
        ]}
      />

      <Dialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Layer</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            For manual digitizing or adding records one by one. If you already have a CSV/KML/SHP file,
            use <strong>Import Survey File</strong> from the Point, Line, or Polygon section instead.
          </Typography>
          <Box display="flex" gap={2} mt={1} mb={2} flexWrap="wrap">
            <TextField
              label="Code" placeholder="survey_points"
              value={classForm.code}
              onChange={(e) => setClassForm({
                ...classForm,
                code: toSnakeCaseIdentifier(e.target.value, ''),
              })}
              helperText={classForm.code
                ? `Stored as ${classForm.code}`
                : 'Optional — auto-generated from name if empty'}
              sx={{ flex: '1 1 180px' }}
            />
            <TextField
              label="Name" required
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              sx={{ flex: '1 1 180px' }}
            />
            <FormControl sx={{ flex: '1 1 160px' }}>
              <InputLabel>Geometry Type</InputLabel>
              <Select
                label="Geometry Type"
                value={classForm.geometryType}
                onChange={(e) => setClassForm({
                  ...classForm,
                  geometryType: e.target.value as typeof classForm.geometryType,
                })}
              >
                {GEOMETRY_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{GEOMETRY_TYPE_LABELS[type]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <TextField
            label="Description" fullWidth multiline rows={2} sx={{ mb: 2 }}
            value={classForm.description}
            onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
          />

          <Typography variant="subtitle2" gutterBottom>Attribute Table Fields</Typography>
          {classForm.attributeSchema.map((field, index) => (
            <Box key={index} display="flex" gap={1} mb={1} alignItems="center" flexWrap="wrap">
              <TextField
                label="Column label" size="small" value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Pipe diameter"
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type" value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value as AttributeField['type'] })}
                >
                  {FIELD_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                }
                label="Required"
              />
              {field.type === 'select' && (
                <TextField
                  label="Options (comma-separated)" size="small" sx={{ minWidth: 180 }}
                  value={(field.options ?? []).join(', ')}
                  onChange={(e) => updateField(index, {
                    options: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                  })}
                />
              )}
              <IconButton onClick={() => removeField(index)} disabled={classForm.attributeSchema.length === 1}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={addField}>Add Field</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveClass}>Create Layer</Button>
        </DialogActions>
      </Dialog>

      <ImportFeatureClassDialog
        open={importClassDialogOpen}
        projectId={projectId}
        geometryType={importClassGeometryType}
        geometryLabel={
          GEOMETRY_GROUPS.find((group) => group.type === importClassGeometryType)?.label
          ?? `${importClassGeometryType} Layer`
        }
        onClose={() => setImportClassDialogOpen(false)}
        onCreated={handleImportedClassCreated}
        onNavigateMap={navigateToMapLayer}
      />

      <Dialog
        open={scaffoldDialogOpen}
        onClose={() => !scaffoldingLa && setScaffoldDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create standard LA GIS layers</DialogTitle>
        <DialogContent dividers>
          {scaffoldResult ? (
            <Alert severity="success">
              Created <strong>{scaffoldResult.created}</strong> layer(s).
              {scaffoldResult.skipped > 0 && (
                <> Skipped <strong>{scaffoldResult.skipped}</strong> (already present).</>
              )}
              {' '}Total templates: {scaffoldResult.totalTemplates} (44 overlay layers + pipeline alignment).
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" paragraph>
                This creates empty feature classes for all Land Acquisition overlay analysis layers
                (village boundary, khasra, forest, NH/SH roads, railways, rivers, monuments, wetlands, landslide zone, etc.)
                plus <strong>la_alignment</strong> for the pipeline route.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Existing layers with the same code (or alias) are skipped. Import or digitize geometry in Map Explorer afterward.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScaffoldDialogOpen(false)} disabled={scaffoldingLa}>
            {scaffoldResult ? 'Close' : 'Cancel'}
          </Button>
          {!scaffoldResult && (
            <Button
              variant="contained"
              onClick={() => void handleScaffoldLaGisLayers()}
              disabled={scaffoldingLa || !projectId}
              startIcon={scaffoldingLa ? <CircularProgress size={16} color="inherit" /> : <LayersIcon />}
            >
              {scaffoldingLa ? 'Creating…' : 'Create all layers'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={schemaDialogOpen} onClose={() => setSchemaDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Attribute Fields</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Define attribute columns for <strong>{selectedClass?.name}</strong>. They appear as headers in the attribute table.
          </Typography>
          {schemaForm.map((field, index) => (
            <Box key={index} display="flex" gap={1} mb={1} alignItems="center" flexWrap="wrap">
              <TextField
                label="Column label" size="small" value={field.label}
                onChange={(e) => updateSchemaField(index, { label: e.target.value })}
                placeholder="Valve ID"
                sx={{ minWidth: 220 }}
                helperText={field.label.trim()
                  ? `Stored as ${toSnakeCaseIdentifier(field.label, `field_${index + 1}`)}`
                  : 'Shown as the column header in the table'}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type" value={field.type}
                  onChange={(e) => updateSchemaField(index, { type: e.target.value as AttributeField['type'] })}
                >
                  {FIELD_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!field.required}
                    onChange={(e) => updateSchemaField(index, { required: e.target.checked })}
                  />
                }
                label="Required"
              />
              {field.type === 'select' && (
                <TextField
                  label="Options (comma-separated)" size="small" sx={{ minWidth: 180 }}
                  value={(field.options ?? []).join(', ')}
                  onChange={(e) => updateSchemaField(index, {
                    options: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                  })}
                />
              )}
              <IconButton onClick={() => removeSchemaField(index)} disabled={schemaForm.length === 1}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={addSchemaField}>Add Another Column</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSchemaDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveSchema}>Save Fields</Button>
        </DialogActions>
      </Dialog>

      <SurveyImportDialog
        open={importDialogOpen}
        featureClassName={selectedClass?.name ?? ''}
        geometryType={selectedClass?.geometryType ?? 'Point'}
        attributeSchema={selectedClass?.attributeSchema ?? []}
        onClose={() => setImportDialogOpen(false)}
        onImport={importSurveyFeatures}
      />

      <Dialog open={featureDialogOpen} onClose={() => setFeatureDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Record to {selectedClass?.name}</DialogTitle>
        <DialogContent>
          {featureDialogError && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{featureDialogError}</Alert>
          )}
          {selectedClass?.attributeSchema.length === 0 && (
            <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
              No columns defined yet.
            </Alert>
          )}
          {selectedClass?.attributeSchema.map((field) => (
            <Box key={field.name} mt={2}>
              {field.type === 'boolean' ? (
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!featureForm.attributes[field.name]}
                      onChange={(e) => setFeatureForm({
                        ...featureForm,
                        attributes: { ...featureForm.attributes, [field.name]: e.target.checked },
                      })}
                    />
                  }
                  label={field.label}
                />
              ) : field.type === 'select' ? (
                <FormControl fullWidth>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    label={field.label}
                    value={featureForm.attributes[field.name] ?? ''}
                    onChange={(e) => setFeatureForm({
                      ...featureForm,
                      attributes: { ...featureForm.attributes, [field.name]: e.target.value },
                    })}
                  >
                    {(field.options ?? []).map((option) => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  label={field.label}
                  type={field.type === 'number' || field.type === 'integer' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={featureForm.attributes[field.name] ?? ''}
                  onChange={(e) => setFeatureForm({
                    ...featureForm,
                    attributes: {
                      ...featureForm.attributes,
                      [field.name]: field.type === 'number' || field.type === 'integer'
                        ? Number(e.target.value)
                        : e.target.value,
                    },
                  })}
                  InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                />
              )}
            </Box>
          ))}
          {selectedClass?.geometryType === 'Point' ? (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>Location (optional)</Typography>
              <Box display="flex" gap={2}>
                <TextField
                  label="Latitude"
                  type="number"
                  placeholder="12.96"
                  value={featureForm.latitude}
                  onChange={(e) => setFeatureForm({ ...featureForm, latitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Longitude"
                  type="number"
                  placeholder="77.6"
                  value={featureForm.longitude}
                  onChange={(e) => setFeatureForm({ ...featureForm, longitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>
          ) : (
            <TextField
              fullWidth multiline rows={4} sx={{ mt: 2 }}
              label={`Geometry (${selectedClass?.geometryType} GeoJSON, optional)`}
              placeholder={
                selectedClass?.geometryType === 'LineString'
                  ? '{"type":"LineString","coordinates":[[77.6,12.96],[77.61,12.97]]}'
                  : '{"type":"Polygon","coordinates":[[[77.6,12.96],[77.61,12.96],[77.61,12.97],[77.6,12.96]]]}'
              }
              value={featureForm.geometryJson}
              onChange={(e) => setFeatureForm({ ...featureForm, geometryJson: e.target.value })}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeatureDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveFeature}>Save Feature</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
