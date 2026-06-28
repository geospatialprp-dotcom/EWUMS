import { useEffect } from 'react';
import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import { ALL_SCHEMES_LABEL, useCanViewAllDivisions } from '../../utils/divisionAccess';

export type OmProjectOption = { id: string; name: string; projectCode: string };

type OmSchemeProjectSelectProps = {
  projects: OmProjectOption[];
  value: string;
  onChange: (project: OmProjectOption | null) => void;
  minWidth?: number;
  label?: string;
};

export default function OmSchemeProjectSelect({
  projects,
  value,
  onChange,
  minWidth = 220,
  label = 'Scheme / Project',
}: OmSchemeProjectSelectProps) {
  const canViewAll = useCanViewAllDivisions();
  const effectiveValue = canViewAll ? value : (value || projects[0]?.id || '');

  return (
    <FormControl
      size="small"
      sx={{
        minWidth,
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
          bgcolor: '#fff',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0d9488' },
        },
        '& .MuiInputLabel-root.Mui-focused': { color: '#0d9488' },
      }}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={effectiveValue}
        onChange={(event: SelectChangeEvent) => {
          const id = event.target.value;
          onChange(id ? projects.find((project) => project.id === id) ?? null : null);
        }}
      >
        {canViewAll && <MenuItem value="">{ALL_SCHEMES_LABEL}</MenuItem>}
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** Force division-scoped users onto their first accessible scheme. */
export function useRequireOmProjectSelection(
  projects: OmProjectOption[],
  selectedProject: OmProjectOption | null,
  setSelectedProject: (project: OmProjectOption | null) => void,
) {
  const canViewAll = useCanViewAllDivisions();
  useEffect(() => {
    if (canViewAll || !projects.length) return;
    if (!selectedProject || !projects.some((project) => project.id === selectedProject.id)) {
      setSelectedProject(projects[0]);
    }
  }, [canViewAll, projects, selectedProject, setSelectedProject]);
}

export function omProjectScopeLabel(project: OmProjectOption | null, canViewAll: boolean): string {
  if (project) return `${project.projectCode} — ${project.name}`;
  return canViewAll ? ALL_SCHEMES_LABEL : 'Your division schemes';
}
