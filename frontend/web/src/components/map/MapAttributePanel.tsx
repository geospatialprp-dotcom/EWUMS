import {
  Box, IconButton, Paper, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Select, MenuItem, CircularProgress, Tooltip,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import LocationOffOutlinedIcon from '@mui/icons-material/LocationOffOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { useMemo, useState } from 'react';
import type { AttributeField, FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import { featureClassesApi } from '../../services/api';
import { coerceAttributeValue } from '../../utils/featureAttributes';
import { coordinateFieldNames, formatCoordinateString } from '../../utils/coordinateFields';
import {
  ATTRIBUTE_TABLE_INDEX_WIDTH,
  ATTRIBUTE_TABLE_LOC_WIDTH,
  attributeBodyCellSx,
  attributeCellFieldSx,
  attributeHeaderCellWidth,
  attributeIconCellSx,
  attributeTableRowSx,
  attributeTableSx,
  isIconAttributeField,
  pickFlexibleAttributeField,
} from '../../utils/attributeTableStyles';
import { arcMapAttributeHeaderSx, arcMapPanelHeaderSx, ARCMAP } from '../gis/arcMapUi';
import FeatureImageInput from '../shared/FeatureImageInput';
import { formatApiError } from '../../utils/apiError';

interface MapAttributePanelProps {
  featureClass: FeatureClassRecord;
  features: ProjectFeatureRecord[];
  loading?: boolean;
  digitizeActive?: boolean;
  editActive?: boolean;
  analysisActive?: boolean;
  readOnly?: boolean;
  embedded?: boolean;
  subtitle?: string;
  emptyMessage?: string;
  selectedFeatureId?: string | null;
  onSelectFeature?: (featureId: string) => void;
  onDeleteFeature?: (featureId: string) => void;
  deletingFeatureId?: string | null;
  onRefresh: () => void;
  onError?: (message: string) => void;
}

function formatReadOnlyValue(field: AttributeField, raw: unknown) {
  if (raw == null || raw === '') return '—';
  if (field.type === 'boolean') return raw === true ? 'Yes' : 'No';
  return String(raw);
}

export default function MapAttributePanel({
  featureClass,
  features,
  loading,
  digitizeActive,
  editActive,
  analysisActive,
  readOnly,
  embedded,
  subtitle,
  emptyMessage,
  selectedFeatureId,
  onSelectFeature,
  onDeleteFeature,
  deletingFeatureId,
  onRefresh,
  onError,
}: MapAttributePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const coordFieldNames = useMemo(
    () => coordinateFieldNames(featureClass.attributeSchema),
    [featureClass.attributeSchema],
  );
  const flexibleFieldName = useMemo(
    () => pickFlexibleAttributeField(featureClass.attributeSchema, coordFieldNames)?.name ?? null,
    [featureClass.attributeSchema, coordFieldNames],
  );
  const headerCellSx = useMemo(
    () => (embedded ? arcMapAttributeHeaderSx() : {
      fontWeight: 700,
      fontSize: '0.6875rem',
      py: 0.55,
      px: 0.75,
    }),
    [embedded],
  );

  const saveFeatureAttributes = async (
    featureId: string,
    currentAttributes: Record<string, unknown>,
    field: AttributeField,
    rawValue: string,
  ) => {
    const cellKey = `${featureId}:${field.name}`;
    const nextValue = coerceAttributeValue(field, rawValue);
    if (String(currentAttributes[field.name] ?? '') === String(nextValue ?? '')) return;

    setSavingCell(cellKey);
    try {
      await featureClassesApi.updateFeature(featureClass.projectId, featureId, {
        attributes: { ...currentAttributes, [field.name]: nextValue },
      });
      onRefresh();
    } catch (err) {
      onError?.(formatApiError(err, 'Failed to update attribute.'));
    } finally {
      setSavingCell(null);
    }
  };

  const shellSx = {
    ...(embedded ? {} : { borderTop: 1, borderColor: 'divider' }),
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
    ...(expanded ? { maxHeight: 220 } : { height: 44 }),
    flexShrink: 0,
    transition: 'height 0.2s ease',
    flex: embedded ? 1 : undefined,
    minHeight: 0,
  };

  const content = (
    <>
      <Box
        px={embedded ? 1.25 : 2}
        py={embedded ? 0.5 : 0.75}
        display="flex"
        alignItems="center"
        gap={1}
        sx={{
          ...(embedded ? arcMapPanelHeaderSx() : {}),
          ...(expanded ? {} : { borderBottom: 0 }),
        }}
      >
        <TableChartOutlinedIcon sx={{ fontSize: 16, color: ARCMAP.accent }} />
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={700} noWrap fontSize="0.8125rem">
            {featureClass.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
            {subtitle ?? (
              <>
                {featureClass.geometryType} layer · {features.length} record{features.length === 1 ? '' : 's'}
              </>
            )}
          </Typography>
        </Box>
        {loading && <CircularProgress size={18} />}
        {onDeleteFeature && selectedFeatureId && (
          <Tooltip title="Delete selected feature (Del)">
            <span>
              <IconButton
                size="small"
                color="error"
                aria-label="Delete selected feature"
                disabled={deletingFeatureId === selectedFeatureId}
                onClick={() => onDeleteFeature(selectedFeatureId)}
              >
                {deletingFeatureId === selectedFeatureId
                  ? <CircularProgress size={16} color="inherit" />
                  : <DeleteOutlineIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
        </IconButton>
      </Box>

      {expanded && (
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          <Table size="small" stickyHeader sx={attributeTableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{
                  ...headerCellSx,
                  width: ATTRIBUTE_TABLE_INDEX_WIDTH,
                  maxWidth: ATTRIBUTE_TABLE_INDEX_WIDTH,
                }}
                >
                  #
                </TableCell>
                {featureClass.attributeSchema.map((field) => (
                  <TableCell
                    key={field.name}
                    align={isIconAttributeField(field) ? 'center' : 'left'}
                    sx={{
                      ...headerCellSx,
                      ...attributeHeaderCellWidth(field, coordFieldNames, flexibleFieldName),
                    }}
                  >
                    {field.label}
                  </TableCell>
                ))}
                <TableCell
                  sx={{
                    ...headerCellSx,
                    ...attributeIconCellSx,
                    width: ATTRIBUTE_TABLE_LOC_WIDTH,
                    maxWidth: ATTRIBUTE_TABLE_LOC_WIDTH,
                    minWidth: ATTRIBUTE_TABLE_LOC_WIDTH,
                  }}
                  align="center"
                >
                  Loc
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {features.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={featureClass.attributeSchema.length + 2}
                    align="center"
                    sx={{ py: 4, color: 'text.secondary', border: 0 }}
                  >
                    {emptyMessage ?? (
                      featureClass.attributeSchema.length === 0
                        ? 'No attribute fields yet.'
                        : 'No records yet.'
                    )}
                  </TableCell>
                </TableRow>
              )}
              {features.map((feature, index) => (
                <TableRow
                  key={feature.id}
                  hover
                  selected={selectedFeatureId === feature.id}
                  onClick={() => onSelectFeature?.(feature.id)}
                  sx={{
                    cursor: onSelectFeature ? 'pointer' : 'default',
                    '&:nth-of-type(even)': { bgcolor: '#fafbfc' },
                    ...attributeTableRowSx,
                    ...(selectedFeatureId === feature.id ? {
                      bgcolor: analysisActive
                        ? 'rgba(0, 137, 123, 0.14) !important'
                        : 'rgba(21, 101, 192, 0.12) !important',
                      '& td:first-of-type': {
                        boxShadow: analysisActive
                          ? 'inset 3px 0 0 #00897B'
                          : 'inset 3px 0 0 #1565C0',
                      },
                    } : {}),
                  }}
                >
                  <TableCell sx={{
                    ...attributeBodyCellSx(
                      { name: '_index', label: '#', type: 'integer', required: false },
                      coordFieldNames,
                      { color: 'text.secondary', fontSize: '0.8125rem' },
                    ),
                    width: ATTRIBUTE_TABLE_INDEX_WIDTH,
                    maxWidth: ATTRIBUTE_TABLE_INDEX_WIDTH,
                    minWidth: ATTRIBUTE_TABLE_INDEX_WIDTH,
                  }}
                  >
                    {index + 1}
                  </TableCell>
                  {featureClass.attributeSchema.map((field) => {
                    const cellKey = `${feature.id}:${field.name}`;
                    const rawValue = feature.properties.attributes[field.name];
                    const isCoordField = coordFieldNames.has(field.name);
                    const value = isCoordField
                      ? (formatCoordinateString(rawValue) ?? String(rawValue ?? ''))
                      : String(rawValue ?? '');
                    return (
                      <TableCell
                        key={field.name}
                        align={isIconAttributeField(field) ? 'center' : 'left'}
                        sx={attributeBodyCellSx(
                          field,
                          coordFieldNames,
                          isIconAttributeField(field) ? attributeIconCellSx : {},
                          flexibleFieldName,
                        )}
                      >
                        {readOnly ? (
                          field.type === 'image' && typeof feature.properties.attributes[field.name] === 'string'
                            && feature.properties.attributes[field.name] ? (
                              <FeatureImageInput
                                compact
                                disabled
                                value={feature.properties.attributes[field.name] as string}
                                onChange={() => {}}
                              />
                            ) : (
                              <Typography variant="body2" noWrap title={value} sx={{ fontSize: '0.8125rem' }}>
                                {isCoordField && value
                                  ? value
                                  : formatReadOnlyValue(field, rawValue)}
                              </Typography>
                            )
                        ) : field.type === 'boolean' ? (
                          <Switch
                            size="small"
                            checked={feature.properties.attributes[field.name] === true}
                            disabled={savingCell === cellKey}
                            onClick={(event) => event.stopPropagation()}
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
                            variant="outlined"
                            fullWidth
                            value={value}
                            disabled={savingCell === cellKey}
                            displayEmpty
                            sx={attributeCellFieldSx}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              void saveFeatureAttributes(
                                feature.id,
                                feature.properties.attributes,
                                field,
                                String(event.target.value),
                              );
                            }}
                          >
                            <MenuItem value=""><em>Empty</em></MenuItem>
                            {(field.options ?? []).map((option) => (
                              <MenuItem key={option} value={option}>{option}</MenuItem>
                            ))}
                          </Select>
                        ) : field.type === 'image' ? (
                          <Box
                            onClick={(event) => event.stopPropagation()}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              minHeight: 28,
                            }}
                          >
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
                          </Box>
                        ) : (
                          <TextField
                            key={`${cellKey}-${value}`}
                            size="small"
                            variant="outlined"
                            fullWidth
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
                            onClick={(event) => event.stopPropagation()}
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
                  <TableCell
                    align="center"
                    sx={{
                      ...attributeIconCellSx,
                      width: ATTRIBUTE_TABLE_LOC_WIDTH,
                      maxWidth: ATTRIBUTE_TABLE_LOC_WIDTH,
                      minWidth: ATTRIBUTE_TABLE_LOC_WIDTH,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 28 }}>
                      <Tooltip title={feature.geometry ? 'Has geometry' : 'No geometry'}>
                        {feature.geometry ? (
                          <LocationOnOutlinedIcon fontSize="small" color="success" />
                        ) : (
                          <LocationOffOutlinedIcon fontSize="small" color="disabled" />
                        )}
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </>
  );

  if (embedded) {
    return <Box sx={shellSx}>{content}</Box>;
  }

  return (
    <Paper elevation={0} square sx={shellSx}>
      {content}
    </Paper>
  );
}
