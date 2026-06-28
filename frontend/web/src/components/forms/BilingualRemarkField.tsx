import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import type { BilingualText } from '../../utils/bilingualText';
import { hasBilingualContent } from '../../utils/bilingualText';
import { openRemarksDocumentPdf, type RemarksPdfMetaRow } from '../../utils/remarksDocumentPdf';

export type RemarkLanguage = 'en' | 'hi';

export interface BilingualRemarkFieldProps {
  label?: string;
  pdfTitle: string;
  pdfSubtitle?: string;
  pdfMeta?: RemarksPdfMetaRow[];
  value: BilingualText;
  onChange: (value: BilingualText) => void;
  minRows?: number;
  required?: boolean;
  disabled?: boolean;
  showExport?: boolean;
  fullWidth?: boolean;
  margin?: TextFieldProps['margin'];
  size?: TextFieldProps['size'];
  helperText?: string;
  placeholderEn?: string;
  placeholderHi?: string;
}

export default function BilingualRemarkField({
  label = 'Remarks',
  pdfTitle,
  pdfSubtitle,
  pdfMeta,
  value,
  onChange,
  minRows = 3,
  required = false,
  disabled = false,
  showExport = true,
  fullWidth = true,
  margin = 'dense',
  size = 'small',
  helperText,
  placeholderEn = 'Enter remarks in English…',
  placeholderHi = 'हिंदी में टिप्पणी लिखें…',
}: BilingualRemarkFieldProps) {
  const [language, setLanguage] = useState<RemarkLanguage>('en');

  const activeValue = language === 'en' ? value.en : value.hi;
  const canExport = hasBilingualContent(value);

  const filledLanguages = useMemo(() => {
    const tags: string[] = [];
    if (value.en.trim()) tags.push('English');
    if (value.hi.trim()) tags.push('हिंदी');
    return tags;
  }, [value.en, value.hi]);

  const handleChange = (next: string) => {
    onChange(language === 'en' ? { ...value, en: next } : { ...value, hi: next });
  };

  const handleExport = () => {
    openRemarksDocumentPdf({
      title: pdfTitle,
      subtitle: pdfSubtitle,
      bilingual: value,
      meta: pdfMeta,
      fileName: pdfTitle,
    });
  };

  return (
    <Box sx={{ width: fullWidth ? '100%' : undefined }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" mb={0.75}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={language}
          onChange={(_, next) => next && setLanguage(next)}
          aria-label="Remark language"
        >
          <ToggleButton value="en" aria-label="English" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>
            English
          </ToggleButton>
          <ToggleButton value="hi" aria-label="Hindi" sx={{ px: 1.5, py: 0.25, fontSize: '0.8125rem' }}>
            हिंदी
          </ToggleButton>
        </ToggleButtonGroup>

        {showExport && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfOutlinedIcon />}
            disabled={!canExport || disabled}
            onClick={handleExport}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Export PDF
          </Button>
        )}
      </Box>

      <TextField
        fullWidth={fullWidth}
        multiline
        minRows={minRows}
        size={size}
        margin={margin}
        label={language === 'en' ? `${label} (English)` : `${label} (हिंदी)`}
        value={activeValue}
        onChange={(e) => handleChange(e.target.value)}
        required={required && language === 'en'}
        disabled={disabled}
        placeholder={language === 'en' ? placeholderEn : placeholderHi}
        helperText={
          helperText
          ?? (filledLanguages.length > 1
            ? `Saved in ${filledLanguages.join(' + ')}`
            : 'Switch to हिंदी to add Hindi remarks for the same document.')
        }
      />
    </Box>
  );
}
