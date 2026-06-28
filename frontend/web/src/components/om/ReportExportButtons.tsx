import { Box, Button } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { downloadReportCsv, openReportPdfView } from '../../utils/reportExport';

type Props = {
  report: Record<string, unknown>;
  baseName: string;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'outlined' | 'contained' | 'text';
  disabled?: boolean;
};

export default function ReportExportButtons({
  report,
  baseName,
  title,
  size = 'small',
  variant = 'outlined',
  disabled = false,
}: Props) {
  const displayTitle = title ?? String(report.title ?? baseName);

  return (
    <Box display="inline-flex" gap={1} flexWrap="wrap">
      <Button
        size={size}
        variant={variant}
        disabled={disabled}
        startIcon={<DownloadOutlinedIcon />}
        onClick={() => downloadReportCsv(baseName, report)}
      >
        Export CSV
      </Button>
      <Button
        size={size}
        variant={variant}
        disabled={disabled}
        startIcon={<PictureAsPdfOutlinedIcon />}
        onClick={() => openReportPdfView(displayTitle, report)}
      >
        Export PDF
      </Button>
    </Box>
  );
}
