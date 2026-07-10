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
  /** When false, hide "All schemes" — use for forms that require a project. */
  allowAllSchemes?: boolean;
};

export function pickDefaultOmProject(projects: OmProjectOption[]): OmProjectOption | null {
  if (!projects.length) return null;
  const demo = projects.find((p) => /tharali/i.test(`${p.name} ${p.projectCode}`));
  return demo ?? projects[0];
}

export function normalizeOmProjectList(data: unknown): OmProjectOption[] {
  if (Array.isArray(data)) {
    return data.map((p: OmProjectOption) => ({
      id: String(p.id),
      name: String(p.name ?? ''),
      projectCode: String(p.projectCode ?? ''),
    }));
  }
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return normalizeOmProjectList((data as { items: unknown[] }).items);
  }
  return [];
}

export default function OmSchemeProjectSelect({
  projects,
  value,
  onChange,
  minWidth = 220,
  label = 'Scheme / Project',
  allowAllSchemes = true,
}: OmSchemeProjectSelectProps) {
  const canViewAll = useCanViewAllDivisions();
  const showAllSchemes = allowAllSchemes && canViewAll;
  const effectiveValue = showAllSchemes ? value : (value || projects[0]?.id || '');

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
        {showAllSchemes && <MenuItem value="">{ALL_SCHEMES_LABEL}</MenuItem>}
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
  options?: { requireSelection?: boolean },
) {
  const canViewAll = useCanViewAllDivisions();
  const requireSelection = options?.requireSelection ?? false;
  useEffect(() => {
    if (!projects.length) return;
    const valid = selectedProject && projects.some((project) => project.id === selectedProject.id);
    if (requireSelection || !canViewAll) {
      if (!valid) setSelectedProject(pickDefaultOmProject(projects));
    }
  }, [canViewAll, projects, selectedProject, setSelectedProject, requireSelection]);
}

export function omProjectScopeLabel(project: OmProjectOption | null, canViewAll: boolean): string {
  if (project) return `${project.projectCode} — ${project.name}`;
  return canViewAll ? ALL_SCHEMES_LABEL : 'Your division schemes';
}
