import { Button } from '@mui/material';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { useTranslation } from '../../context/LanguageContext';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'outlined' | 'contained' | 'text';
};

export default function ExportPdfButton({
  onClick,
  disabled = false,
  size = 'small',
  variant = 'outlined',
}: Props) {
  const { t } = useTranslation();

  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled}
      startIcon={<PictureAsPdfOutlinedIcon />}
      onClick={onClick}
      sx={{
        borderColor: '#f97316',
        color: '#0f172a',
        fontWeight: 600,
        '&:hover': { borderColor: '#ea580c', bgcolor: 'rgba(249, 115, 22, 0.08)' },
      }}
    >
      {t.common.exportPdf}
    </Button>
  );
}
