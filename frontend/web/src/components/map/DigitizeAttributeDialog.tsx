import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField,
  Typography, Divider,
} from '@mui/material';
import EditLocationAltOutlinedIcon from '@mui/icons-material/EditLocationAltOutlined';
import { useEffect, useState } from 'react';
import type { AttributeField } from '../../services/api';
import { emptyAttributesForSchema } from '../../utils/featureAttributes';
import FeatureImageInput from '../shared/FeatureImageInput';

interface DigitizeAttributeDialogProps {
  open: boolean;
  layerName: string;
  geometryType: string;
  attributeSchema: AttributeField[];
  error?: string;
  saving?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSave: (attributes: Record<string, unknown>) => void;
}

export default function DigitizeAttributeDialog({
  open,
  layerName,
  geometryType,
  attributeSchema,
  error,
  saving,
  loading,
  onClose,
  onSave,
}: DigitizeAttributeDialogProps) {
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (open) setAttributes(emptyAttributesForSchema(attributeSchema));
  }, [open, attributeSchema]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <EditLocationAltOutlinedIcon color="primary" />
          <Box>
            <Typography variant="h6" fontSize="1rem">New Feature</Typography>
            <Typography variant="caption" color="text.secondary">
              {layerName} · {geometryType}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {loading && (
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading layer fields…</Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {attributeSchema.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No attribute fields defined for this layer. The feature will be saved with geometry only.
          </Alert>
        ) : (
          attributeSchema.map((field) => (
            <Box key={field.name} mt={2}>
              {field.type === 'boolean' ? (
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!attributes[field.name]}
                      onChange={(e) => setAttributes({
                        ...attributes,
                        [field.name]: e.target.checked,
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
                    value={attributes[field.name] ?? ''}
                    onChange={(e) => setAttributes({
                      ...attributes,
                      [field.name]: e.target.value,
                    })}
                  >
                    <MenuItem value=""><em>—</em></MenuItem>
                    {(field.options ?? []).map((option) => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : field.type === 'image' ? (
                <Box>
                  <Typography variant="body2" fontWeight={600} mb={1}>{field.label}</Typography>
                  <FeatureImageInput
                    compact
                    value={typeof attributes[field.name] === 'string' ? attributes[field.name] as string : null}
                    onChange={(imageValue) => setAttributes({ ...attributes, [field.name]: imageValue })}
                    onClear={() => setAttributes({ ...attributes, [field.name]: '' })}
                  />
                </Box>
              ) : (
                <TextField
                  fullWidth
                  label={field.label}
                  type={field.type === 'number' || field.type === 'integer' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={attributes[field.name] ?? ''}
                  onChange={(e) => setAttributes({
                    ...attributes,
                    [field.name]: field.type === 'number' || field.type === 'integer'
                      ? Number(e.target.value)
                      : e.target.value,
                  })}
                  InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                />
              )}
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(attributes)} disabled={saving || loading}>
          Save Feature
        </Button>
      </DialogActions>
    </Dialog>
  );
}
