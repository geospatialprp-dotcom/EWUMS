import { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
} from '@mui/material';
import type { AttributeField } from '../../services/api';
import { formatApiError } from '../../utils/apiError';
import type { SurveyGeometryType } from '../../utils/geoImport';
import SurveyImportPanel, { type SurveyImportPayload } from './SurveyImportPanel';

type SurveyImportDialogProps = {
  open: boolean;
  featureClassName: string;
  geometryType: SurveyGeometryType;
  attributeSchema: AttributeField[];
  onClose: () => void;
  onImport: (features: SurveyImportPayload) => Promise<void>;
};

export default function SurveyImportDialog({
  open,
  featureClassName,
  geometryType,
  attributeSchema,
  onClose,
  onImport,
}: SurveyImportDialogProps) {
  const [importPayload, setImportPayload] = useState<SurveyImportPayload | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleClose = () => {
    setImportPayload(null);
    setError('');
    setImporting(false);
    onClose();
  };

  const handleImport = async () => {
    if (!importPayload?.length) return;
    setImporting(true);
    setError('');
    try {
      await onImport(importPayload);
      handleClose();
    } catch (err) {
      setError(formatApiError(err, 'Import failed.'));
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus
      disableRestoreFocus
    >
      <DialogTitle>Import Survey Data</DialogTitle>
      <DialogContent>
        <SurveyImportPanel
          active={open}
          geometryType={geometryType}
          attributeSchema={attributeSchema}
          featureClassName={featureClassName}
          onPayloadChange={setImportPayload}
          onError={setError}
        />
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!importPayload?.length || importing}
          onClick={handleImport}
        >
          {importing
            ? 'Importing…'
            : `Import ${importPayload?.length ?? 0} Feature${importPayload?.length === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
