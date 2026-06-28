import { useEffect, useRef } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import FingerprintOutlinedIcon from '@mui/icons-material/FingerprintOutlined';

export type ConsumerConsentMode = 'signature' | 'thumb';

type Props = {
  value: string;
  onChange: (dataUrl: string) => void;
  mode: ConsumerConsentMode;
  onModeChange: (mode: ConsumerConsentMode) => void;
  height?: number;
};

function paintCanvasBackground(ctx: CanvasRenderingContext2D, width: number, height: number, mode: ConsumerConsentMode) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (mode === 'thumb') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(width * 0.22, height * 0.18, width * 0.56, height * 0.64);
    ctx.setLineDash([]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press thumb here', width / 2, height * 0.52);
  }
}

function stampThumb(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const rx = 30;
  const ry = 38;
  ctx.save();
  ctx.fillStyle = 'rgba(30, 58, 95, 0.62)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x, y - i * 5, rx * (0.82 - i * 0.08), ry * (0.5 - i * 0.06), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export default function SignaturePad({
  value,
  onChange,
  mode,
  onModeChange,
  height = 180,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    paintCanvasBackground(ctx, canvas.width, canvas.height, mode);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = value;
    }
  }, [value, mode]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const commitCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const point = getPoint(event);
    if (!canvas || !ctx || !point) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);

    if (modeRef.current === 'thumb') {
      stampThumb(ctx, point.x, point.y);
      commitCanvas();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const point = getPoint(event);
    if (!canvas || !ctx || !point) return;

    if (modeRef.current === 'thumb') {
      stampThumb(ctx, point.x, point.y);
      commitCanvas();
      return;
    }

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commitCanvas();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    paintCanvasBackground(ctx, canvas.width, canvas.height, mode);
    onChange('');
  };

  const switchMode = (next: ConsumerConsentMode) => {
    if (next === mode) return;
    onModeChange(next);
    onChange('');
  };

  const padHeight = mode === 'thumb' ? Math.max(height, 200) : height;

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" mb={1}>
        <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
          {mode === 'thumb' ? 'Thumb impression' : 'Consumer signature'}
        </Typography>
        <Box display="flex" gap={0.75}>
          <Chip
            clickable
            size="small"
            icon={<DrawOutlinedIcon />}
            label="Signature"
            onClick={() => switchMode('signature')}
            sx={{
              fontWeight: 700,
              bgcolor: mode === 'signature' ? '#eff6ff' : '#fff',
              color: mode === 'signature' ? '#1d4ed8' : '#64748b',
              border: '1px solid',
              borderColor: mode === 'signature' ? '#93c5fd' : '#e2e8f0',
            }}
          />
          <Chip
            clickable
            size="small"
            icon={<FingerprintOutlinedIcon />}
            label="Thumb"
            onClick={() => switchMode('thumb')}
            sx={{
              fontWeight: 700,
              bgcolor: mode === 'thumb' ? '#ecfdf5' : '#fff',
              color: mode === 'thumb' ? '#0f766e' : '#64748b',
              border: '1px solid',
              borderColor: mode === 'thumb' ? '#99f6e4' : '#e2e8f0',
            }}
          />
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
        {mode === 'thumb'
          ? 'For consumers who cannot sign — ask them to press thumb firmly in the box.'
          : 'Ask the consumer to sign with finger or stylus.'}
      </Typography>

      <Box sx={{ border: '1px solid #cbd5e1', borderRadius: 2.5, bgcolor: '#fff', touchAction: 'none', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={padHeight}
          style={{ width: '100%', height: padHeight, display: 'block' }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </Box>
      <Button size="small" sx={{ mt: 1, fontWeight: 700 }} onClick={clear}>
        {mode === 'thumb' ? 'Clear thumb impression' : 'Clear signature'}
      </Button>
    </Box>
  );
}
