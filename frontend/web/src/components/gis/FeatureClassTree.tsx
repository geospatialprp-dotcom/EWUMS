import { ReactNode, useMemo } from 'react';
import {
  Box, Checkbox, Collapse, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import LayersIcon from '@mui/icons-material/Layers';
import TableChartIcon from '@mui/icons-material/TableChart';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DeleteIcon from '@mui/icons-material/Delete';
import { AttributeField, FeatureClassRecord, ProjectFeatureRecord } from '../../services/api';
import { ARCMAP } from './arcMapUi';

export type TreeSelection =
  | { type: 'project' }
  | { type: 'geometry-group'; geometryType: string }
  | { type: 'feature-class'; classId: string }
  | { type: 'attribute-table'; classId: string }
  | { type: 'field'; classId: string; fieldName: string }
  | { type: 'features-folder'; classId: string }
  | { type: 'feature'; classId: string; featureId: string };

const GEOMETRY_GROUPS = [
  { type: 'Point', label: 'Point Feature Classes', icon: PlaceIcon },
  { type: 'LineString', label: 'Polyline Feature Classes', icon: TimelineIcon },
  { type: 'Polygon', label: 'Polygon Feature Classes', icon: CropSquareIcon },
  { type: 'Any', label: 'Mixed Feature Classes', icon: LayersIcon },
] as const;

interface FeatureClassTreeProps {
  projectName: string;
  classes: FeatureClassRecord[];
  featuresByClass: Record<string, ProjectFeatureRecord[]>;
  expanded: Record<string, boolean>;
  visibility: Record<string, boolean>;
  selection: TreeSelection | null;
  onToggleExpand: (nodeId: string) => void;
  onToggleVisibility: (classId: string, visible: boolean) => void;
  onSelect: (selection: TreeSelection) => void;
  onDeleteClass?: (classId: string) => void;
  onLoadFeatures?: (classId: string) => void;
}

function nodeId(...parts: string[]) {
  return parts.join('::');
}

function TreeNode({
  id, depth, label, icon, endIcon, checked, indeterminate, selected, expanded, hasChildren,
  onToggleExpand, onClick, onCheck,
}: {
  id: string;
  depth: number;
  label: ReactNode;
  icon?: ReactNode;
  endIcon?: ReactNode;
  checked?: boolean;
  indeterminate?: boolean;
  selected?: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  onCheck?: (checked: boolean) => void;
}) {
  return (
    <ListItemButton
      dense
      selected={selected}
      onClick={onClick}
      sx={{
        pl: 0.75 + depth * 1.25,
        py: 0,
        minHeight: 22,
        borderRadius: 0,
        border: selected ? `1px solid ${ARCMAP.selectionBorder}` : '1px solid transparent',
        bgcolor: selected ? ARCMAP.selectionBg : 'transparent',
        '&.Mui-selected': {
          bgcolor: ARCMAP.selectionBg,
          '&:hover': { bgcolor: '#b8dcff' },
        },
        '&:hover': { bgcolor: selected ? ARCMAP.selectionBg : '#f0f6fc' },
      }}
    >
      <ListItemIcon sx={{ minWidth: 22 }}>
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
            sx={{ p: 0, width: 18, height: 18 }}
          >
            {expanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        ) : (
          <Box width={18} />
        )}
      </ListItemIcon>
      {onCheck !== undefined && (
        <Checkbox
          size="small"
          checked={!!checked}
          indeterminate={indeterminate}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onCheck(e.target.checked)}
          sx={{ p: 0, mr: 0.35, '& .MuiSvgIcon-root': { fontSize: 16 } }}
        />
      )}
      {icon && <ListItemIcon sx={{ minWidth: 20, mr: 0.25 }}>{icon}</ListItemIcon>}
      <ListItemText
        primary={label}
        primaryTypographyProps={{ variant: 'body2', noWrap: true, fontSize: '0.75rem', lineHeight: 1.2 }}
      />
      {endIcon}
    </ListItemButton>
  );
}

function isSelected(selection: TreeSelection | null, target: TreeSelection): boolean {
  if (!selection) return false;
  return JSON.stringify(selection) === JSON.stringify(target);
}

export default function FeatureClassTree({
  projectName, classes, featuresByClass, expanded, visibility, selection,
  onToggleExpand, onToggleVisibility, onSelect, onDeleteClass, onLoadFeatures,
}: FeatureClassTreeProps) {
  const classesByGeometry = useMemo(() => {
    const map: Record<string, FeatureClassRecord[]> = {
      Point: [], LineString: [], Polygon: [], Any: [],
    };
    classes.forEach((featureClass) => {
      map[featureClass.geometryType]?.push(featureClass);
    });
    return map;
  }, [classes]);

  const projectExpanded = expanded[nodeId('project')] ?? true;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        bgcolor: ARCMAP.tocBg,
      }}
    >
      <Box sx={{
        px: 1,
        py: 0.5,
        borderBottom: `1px solid ${ARCMAP.panelHeaderBorder}`,
        background: ARCMAP.panelHeaderBg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
      >
        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem', color: ARCMAP.text }}>
          List By Drawing Order
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
      <List dense disablePadding sx={{ py: 0.25 }}>
        <TreeNode
          id={nodeId('project')}
          depth={0}
          label={projectName}
          icon={projectExpanded ? <FolderOpenIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" color="primary" />}
          selected={isSelected(selection, { type: 'project' })}
          expanded={projectExpanded}
          hasChildren
          onToggleExpand={() => onToggleExpand(nodeId('project'))}
          onClick={() => onSelect({ type: 'project' })}
        />

        <Collapse in={projectExpanded} timeout="auto" unmountOnExit>
          {GEOMETRY_GROUPS.map((group) => {
            const groupId = nodeId('group', group.type);
            const groupClasses = classesByGeometry[group.type] ?? [];
            const groupExpanded = expanded[groupId] ?? groupClasses.length > 0;
            const GroupIcon = group.icon;

            return (
              <Box key={group.type}>
                <TreeNode
                  id={groupId}
                  depth={1}
                  label={`${group.label} (${groupClasses.length})`}
                  icon={<GroupIcon fontSize="small" color="action" />}
                  selected={isSelected(selection, { type: 'geometry-group', geometryType: group.type })}
                  expanded={groupExpanded}
                  hasChildren={groupClasses.length > 0}
                  onToggleExpand={() => onToggleExpand(groupId)}
                  onClick={() => onSelect({ type: 'geometry-group', geometryType: group.type })}
                />

                <Collapse in={groupExpanded} timeout="auto" unmountOnExit>
                  {groupClasses.map((featureClass) => {
                    const classNodeId = nodeId('class', featureClass.id);
                    const classExpanded = expanded[classNodeId] ?? false;
                    const classFeatures = featuresByClass[featureClass.id] ?? [];
                    const attrNodeId = nodeId('attrs', featureClass.id);
                    const featuresNodeId = nodeId('features', featureClass.id);
                    const attrsExpanded = expanded[attrNodeId] ?? false;
                    const featuresExpanded = expanded[featuresNodeId] ?? false;

                    return (
                      <Box key={featureClass.id}>
                        <TreeNode
                          id={classNodeId}
                          depth={2}
                          label={
                            <Typography variant="body2" fontSize="0.8rem" noWrap>{featureClass.name}</Typography>
                          }
                          icon={<LayersIcon fontSize="small" sx={{ color: '#5c6bc0' }} />}
                          checked={visibility[featureClass.id] ?? true}
                          selected={isSelected(selection, { type: 'feature-class', classId: featureClass.id })}
                          expanded={classExpanded}
                          hasChildren
                          onCheck={(v) => onToggleVisibility(featureClass.id, v)}
                          onToggleExpand={() => {
                            if (!classExpanded && onLoadFeatures) onLoadFeatures(featureClass.id);
                            onToggleExpand(classNodeId);
                          }}
                          onClick={() => {
                            onSelect({ type: 'feature-class', classId: featureClass.id });
                            if (onLoadFeatures) onLoadFeatures(featureClass.id);
                          }}
                          endIcon={onDeleteClass && (
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); onDeleteClass(featureClass.id); }}
                            >
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          )}
                        />

                        <Collapse in={classExpanded} timeout="auto" unmountOnExit>
                          <TreeNode
                            id={attrNodeId}
                            depth={3}
                            label={`Attribute Table (${featureClass.attributeSchema.length} fields)`}
                            icon={<TableChartIcon fontSize="small" />}
                            selected={isSelected(selection, { type: 'attribute-table', classId: featureClass.id })}
                            expanded={attrsExpanded}
                            hasChildren={featureClass.attributeSchema.length > 0}
                            onToggleExpand={() => onToggleExpand(attrNodeId)}
                            onClick={() => onSelect({ type: 'attribute-table', classId: featureClass.id })}
                          />

                          <Collapse in={attrsExpanded} timeout="auto" unmountOnExit>
                            {featureClass.attributeSchema.map((field) => (
                              <TreeNode
                                key={field.name}
                                id={nodeId('field', featureClass.id, field.name)}
                                depth={4}
                                label={
                                  <Typography variant="body2" fontSize="0.75rem">{field.label}</Typography>
                                }
                                icon={<DataObjectIcon sx={{ fontSize: 14 }} color="disabled" />}
                                selected={isSelected(selection, {
                                  type: 'field', classId: featureClass.id, fieldName: field.name,
                                })}
                                onClick={() => onSelect({
                                  type: 'field', classId: featureClass.id, fieldName: field.name,
                                })}
                              />
                            ))}
                          </Collapse>

                          <TreeNode
                            id={featuresNodeId}
                            depth={3}
                            label={`Features (${classFeatures.length || featureClass.featureCount || 0})`}
                            icon={<PlaceIcon fontSize="small" sx={{ fontSize: 16 }} />}
                            selected={isSelected(selection, { type: 'features-folder', classId: featureClass.id })}
                            expanded={featuresExpanded}
                            hasChildren={classFeatures.length > 0}
                            onToggleExpand={() => {
                              if (!featuresExpanded && onLoadFeatures) onLoadFeatures(featureClass.id);
                              onToggleExpand(featuresNodeId);
                            }}
                            onClick={() => {
                              onSelect({ type: 'features-folder', classId: featureClass.id });
                              if (onLoadFeatures) onLoadFeatures(featureClass.id);
                            }}
                          />

                          <Collapse in={featuresExpanded} timeout="auto" unmountOnExit>
                            {classFeatures.map((feature, index) => (
                              <TreeNode
                                key={feature.id}
                                id={nodeId('feature', featureClass.id, feature.id)}
                                depth={4}
                                label={`Feature ${index + 1}`}
                                icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />}
                                selected={isSelected(selection, {
                                  type: 'feature', classId: featureClass.id, featureId: feature.id,
                                })}
                                onClick={() => onSelect({
                                  type: 'feature', classId: featureClass.id, featureId: feature.id,
                                })}
                              />
                            ))}
                          </Collapse>
                        </Collapse>
                      </Box>
                    );
                  })}
                </Collapse>
              </Box>
            );
          })}
        </Collapse>
      </List>
      </Box>
    </Box>
  );
}

export { GEOMETRY_GROUPS, nodeId };
