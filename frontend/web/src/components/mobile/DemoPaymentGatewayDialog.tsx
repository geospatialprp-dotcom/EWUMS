import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, Typography,
} from '@mui/material';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import {
  emitDemoPaymentGatewayResult,
  formatGatewayAmount,
  type PaymentGatewayOrder,
} from '../../utils/paymentGateway';

export default function DemoPaymentGatewayDialog() {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<PaymentGatewayOrder | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<PaymentGatewayOrder>).detail;
      setOrder(detail);
      setOpen(true);
      setProcessing(false);
    };
    window.addEventListener('egip-open-demo-gateway', onOpen as EventListener);
    return () => window.removeEventListener('egip-open-demo-gateway', onOpen as EventListener);
  }, []);

  const close = (cancelled = true) => {
    setOpen(false);
    if (cancelled) emitDemoPaymentGatewayResult({ cancelled: true });
  };

  const confirmPayment = () => {
    if (!order) return;
    setProcessing(true);
    window.setTimeout(() => {
      emitDemoPaymentGatewayResult({
        razorpayOrderId: order.orderId,
        razorpayPaymentId: `pay_demo_${Date.now()}`,
        razorpaySignature: 'demo_signature',
      });
      setOpen(false);
      setProcessing(false);
    }, 900);
  };

  const isQr = order?.paymentMode === 'qr_code';

  return (
    <Dialog open={open} onClose={() => close(true)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Box textAlign="center">
          <Chip
            size="small"
            label="Demo payment gateway"
            sx={{ mb: 1.5, fontWeight: 700, bgcolor: '#ecfdf5', color: '#0f766e' }}
          />
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
            {formatGatewayAmount(order?.amount ?? 0)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isQr ? 'Scan & pay simulation' : 'UPI / digital payment simulation'}
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 2.5,
            p: 2,
            borderRadius: 3,
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 132,
              height: 132,
              mx: 'auto',
              mb: 1.5,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #bfdbfe',
            }}
          >
            {isQr ? (
              <QrCodeScannerOutlinedIcon sx={{ fontSize: 56, color: '#1d4ed8' }} />
            ) : (
              <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 56, color: '#0f766e' }} />
            )}
          </Box>
          <Typography variant="body2" fontWeight={700}>
            {order?.consumerLabel ?? 'Consumer payment'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Order {order?.orderId}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, textAlign: 'center' }}>
          Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live UPI / QR collections.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
        <Button onClick={() => close(true)} disabled={processing} sx={{ fontWeight: 700 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={confirmPayment}
          disabled={processing}
          sx={{ fontWeight: 800, minWidth: 140, bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}
        >
          {processing ? 'Processing…' : isQr ? 'Simulate QR Pay' : 'Simulate UPI Pay'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
