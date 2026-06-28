import { Box, Chip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export type LaPipelineWorkflowState = {
  hasProject: boolean;
  hasImportedOrAppliedRoute: boolean;
  alignmentCount: number;
  parcelCount: number;
  clearanceCount: number;
};

type StepDef = {
  code: string;
  label: string;
  hint: string;
  done: (s: LaPipelineWorkflowState) => boolean;
};

const PIPELINE_WORKFLOW_STEPS: StepDef[] = [
  {
    code: 'import',
    label: '1. Import Network',
    hint: 'Auto Route → upload SHP/GeoJSON line network',
    done: (s) => s.hasImportedOrAppliedRoute,
  },
  {
    code: 'compare',
    label: '2. AI Compare',
    hint: 'AI Route Compare → review alternatives → Apply',
    done: (s) => s.alignmentCount > 0,
  },
  {
    code: 'trace',
    label: '3. Trace ROW',
    hint: 'Trace Alignment → corridor buffer on map',
    done: (s) => s.alignmentCount > 0,
  },
  {
    code: 'parcels',
    label: '4. Identify Parcels',
    hint: 'Intersect ROW with Revenue / cadastral layers',
    done: (s) => s.parcelCount > 0,
  },
  {
    code: 'clearances',
    label: '5. Detect Clearances',
    hint: 'Forest, PWD, NHAI, Railway & integrated authority GIS',
    done: (s) => s.clearanceCount > 0,
  },
  {
    code: 'publish',
    label: '6. Publish Map',
    hint: 'Acquisition Map tab → Publish Acquisition Map',
    done: () => false,
  },
];

function activeStepIndex(state: LaPipelineWorkflowState): number {
  const idx = PIPELINE_WORKFLOW_STEPS.findIndex((step) => !step.done(state));
  return idx < 0 ? PIPELINE_WORKFLOW_STEPS.length - 1 : idx;
}

export default function LaPipelineWorkflowGuide({ state }: { state: LaPipelineWorkflowState }) {
  const activeIdx = activeStepIndex(state);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'grey.50',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={1}>
        <Typography variant="subtitle2" fontWeight={700}>
          Pipeline Network Workflow
        </Typography>
        {!state.hasProject && (
          <Chip size="small" color="warning" variant="outlined" label="Link GIS project first" />
        )}
      </Box>
      <Box display="flex" flexWrap="wrap" alignItems="center" gap={0.5}>
        {PIPELINE_WORKFLOW_STEPS.map((step, index) => {
          const done = step.done(state);
          const isCurrent = index === activeIdx && !done;
          return (
            <Box key={step.code} display="flex" alignItems="center" gap={0.5}>
              <Box
                display="flex"
                alignItems="center"
                gap={0.5}
                px={1}
                py={0.35}
                borderRadius={1}
                sx={{
                  bgcolor: isCurrent ? 'primary.main' : 'transparent',
                  color: isCurrent ? 'primary.contrastText' : 'text.primary',
                  border: isCurrent ? 'none' : '1px solid',
                  borderColor: done ? 'success.light' : 'divider',
                }}
              >
                {done ? (
                  <CheckCircleIcon sx={{ fontSize: 14, color: isCurrent ? 'inherit' : 'success.main' }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ fontSize: 14, opacity: isCurrent ? 1 : 0.5 }} />
                )}
                <Typography variant="caption" fontWeight={isCurrent ? 700 : 500} title={step.hint}>
                  {step.label}
                </Typography>
              </Box>
              {index < PIPELINE_WORKFLOW_STEPS.length - 1 && (
                <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              )}
            </Box>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
        Next: {PIPELINE_WORKFLOW_STEPS[activeIdx]?.hint ?? 'Workflow complete — publish the acquisition map.'}
      </Typography>
    </Box>
  );
}
