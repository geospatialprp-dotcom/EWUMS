import {
  Box, Chip, Typography, useTheme,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import {
  buildLaWorkflowProgressLocal,
  type LaWorkflowProgress,
  type LaWorkflowStepState,
} from '../../constants/laWorkflow';

function stepColor(state: LaWorkflowStepState, theme: ReturnType<typeof useTheme>) {
  if (state === 'done') return theme.palette.success.main;
  if (state === 'current') return theme.palette.primary.main;
  return theme.palette.text.disabled;
}

function StepIcon({ state }: { state: LaWorkflowStepState }) {
  if (state === 'done') return <CheckCircleOutlineIcon fontSize="small" color="success" />;
  if (state === 'current') return <PlayCircleOutlineIcon fontSize="small" color="primary" />;
  return <RadioButtonUncheckedIcon fontSize="small" color="disabled" />;
}

export default function LaWorkflowPipeline({
  status,
  workflow,
  compact = false,
}: {
  status?: string;
  workflow?: LaWorkflowProgress | null;
  compact?: boolean;
}) {
  const theme = useTheme();
  const progress = workflow ?? buildLaWorkflowProgressLocal(status);
  const steps = progress.steps ?? [];

  let lastGroup = '';

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
        <Typography variant="subtitle2" fontWeight={700}>Workflow</Typography>
        {progress.statusLabel && (
          <Chip
            size="small"
            color={progress.status === 'construction_started' ? 'success' : 'primary'}
            variant="outlined"
            label={`Current: ${progress.statusLabel}`}
          />
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact
            ? { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }
            : '1fr',
          gap: 0,
        }}
      >
        {steps.map((step, i) => {
          const showGroupHeader = step.groupLabel && step.groupLabel !== lastGroup;
          if (step.groupLabel) lastGroup = step.groupLabel;
          const isApproval = step.group === 'approval';
          const showApprovalHeader = isApproval && i === steps.findIndex((s) => s.group === 'approval');

          return (
            <Box key={step.code}>
              {showApprovalHeader && (
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ display: 'block', mt: i > 0 ? 1 : 0, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.6 }}
                >
                  {progress.approvalGroupLabel ?? 'Approval Workflow'}
                </Typography>
              )}
              {showGroupHeader && !showApprovalHeader && (
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {step.groupLabel}
                </Typography>
              )}

              <Box
                display="flex"
                alignItems="center"
                gap={1}
                py={compact ? 0.35 : 0.5}
                px={1}
                borderRadius={1}
                sx={{
                  bgcolor: step.state === 'current' ? 'action.selected' : 'transparent',
                  borderLeft: step.state === 'current' ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                }}
              >
                <StepIcon state={step.state} />
                <Typography
                  variant="body2"
                  fontWeight={step.state === 'current' ? 700 : 400}
                  color={stepColor(step.state, theme)}
                >
                  {step.label}
                </Typography>
              </Box>

              {!compact && i < steps.length - 1 && (
                <Box display="flex" justifyContent="flex-start" pl={1.2} py={0.15}>
                  <ArrowDownwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
