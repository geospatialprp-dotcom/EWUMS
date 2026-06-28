import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import axios from 'axios';

interface ForgotPasswordDialogProps {
  open: boolean;
  initialEmail?: string;
  onClose: () => void;
}

function formatApiMessage(message: unknown): string | undefined {
  if (!message) return undefined;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  return undefined;
}

export default function ForgotPasswordDialog({ open, initialEmail = '', onClose }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
      setError('');
      setSuccess('');
    }
  }, [open, initialEmail]);

  const handleClose = () => {
    if (loading) return;
    setError('');
    setSuccess('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/v1/auth/forgot-password', { email: email.trim() });
      setSuccess(data?.message ?? 'Reset request submitted. Check with your administrator.');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(formatApiMessage(err.response?.data?.message) ?? 'Unable to submit reset request. Try again later.');
      } else {
        setError('Unable to submit reset request. Try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Forgot password?</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your account email. An administrator will be notified to reset your password.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <TextField
            fullWidth
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || !!success}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleClose} disabled={loading}>
            {success ? 'Close' : 'Cancel'}
          </Button>
          {!success && (
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit request'}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
