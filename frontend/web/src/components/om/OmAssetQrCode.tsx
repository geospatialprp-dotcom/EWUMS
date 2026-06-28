import { useMemo } from 'react';
import { Box } from '@mui/material';
import { resolveOmAssetQrValue } from '../../utils/omAssetQr';
import { renderQrDataUrl } from '../../vendor/qrCodeSvg';

type OmAssetQrCodeProps = {
  asset: { id: string; assetCode: string; qrCode?: string | null };
  size?: number;
  padding?: number;
};

export default function OmAssetQrCode({ asset, size = 220, padding = 12 }: OmAssetQrCodeProps) {
  const value = resolveOmAssetQrValue(asset);
  const dataUrl = useMemo(() => renderQrDataUrl(value, size), [value, size]);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        p: `${padding}px`,
        bgcolor: '#fff',
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        lineHeight: 0,
      }}
    >
      <Box
        component="img"
        src={dataUrl}
        alt={`QR code for asset ${asset.assetCode}`}
        width={size}
        height={size}
        sx={{ display: 'block', imageRendering: 'pixelated' }}
      />
    </Box>
  );
}
