import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, InputAdornment,
  Stack, TextField, Typography,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import BadgeIcon from '@mui/icons-material/Badge';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import PinIcon from '@mui/icons-material/Pin';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import axios from 'axios';
import { useConsumerPortal } from '../context/ConsumerPortalContext';
import { consumerPortalApi } from '../services/portalApi';
import LoginBrandLogo from '../components/branding/LoginBrandLogo';
import LoginAmbientBackground from '../components/auth/LoginAmbientBackground';
import { APP_BRAND } from '../constants/branding';
import { consumerFieldSx, consumerGlassCardSx } from '../components/auth/loginPageTheme';
import StandaloneChrome from '../components/layout/StandaloneChrome';

const FEATURES = [
  {
    icon: ReceiptLongIcon,
    title: 'Bills & receipts',
    body: 'View dues, download bills, and check payment history anytime.',
    color: '#0284c7',
    bg: 'linear-gradient(135deg, rgba(2,132,199,0.15), rgba(56,189,248,0.08))',
    delay: 0,
  },
  {
    icon: SupportAgentIcon,
    title: 'Complaints & help',
    body: 'Register water supply issues and track resolution status.',
    color: '#7c3aed',
    bg: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(167,139,250,0.08))',
    delay: 0.1,
  },
  {
    icon: TrackChangesIcon,
    title: 'Application tracking',
    body: 'Follow new connection and service requests in one place.',
    color: '#0d9488',
    bg: 'linear-gradient(135deg, rgba(13,148,136,0.14), rgba(45,212,191,0.08))',
    delay: 0.2,
  },
  {
    icon: WaterDropIcon,
    title: 'Jal Mitra 24×7',
    body: 'Voice assistant in Garhwali, Kumaoni, Hindi, and English.',
    color: '#0369a1',
    bg: 'linear-gradient(135deg, rgba(3,105,161,0.16), rgba(14,165,233,0.08))',
    delay: 0.3,
  },
] as const;

function getLoginError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot connect to backend API. Start: cd backend/api && npm run start:dev';
    const msg = err.response.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
    if (err.response.status === 401) return 'FHTC number and mobile do not match our records';
  }
  return 'Login failed';
}

function StepIndicator({
  step,
  useOtpFlow,
}: {
  step: 'credentials' | 'otp';
  useOtpFlow: boolean;
}) {
  const steps = useOtpFlow
    ? [
        { id: 'credentials', label: 'Account details' },
        { id: 'otp', label: 'Verify OTP' },
      ]
    : [{ id: 'credentials', label: 'Sign in' }];

  return (
    <Stack direction="row" alignItems="center" spacing={0} sx={{ mb: 2.5 }}>
      {steps.map((s, i) => {
        const done = step === 'otp' && s.id === 'credentials';
        const active = step === s.id;
        return (
          <Box key={s.id} display="flex" alignItems="center" flex={i < steps.length - 1 ? 1 : undefined}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              {done ? (
                <CheckCircleIcon sx={{ fontSize: 20, color: '#0d9488' }} />
              ) : active ? (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: '#0284c7',
                    boxShadow: '0 0 0 4px rgba(2,132,199,0.2)',
                  }}
                />
              ) : (
                <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: '#cbd5e1' }} />
              )}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: active || done ? 700 : 500,
                  color: active || done ? '#0f172a' : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </Typography>
            </Stack>
            {i < steps.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  mx: 1.5,
                  borderRadius: 999,
                  bgcolor: done ? '#0d9488' : '#e2e8f0',
                  minWidth: 24,
                }}
              />
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

export default function ConsumerPortalLoginPage() {
  const [fhtcNumber, setFhtcNumber] = useState('FHTC-DEMO-001');
  const [mobile, setMobile] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithOtp, token, otpMode } = useConsumerPortal();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/portal', { replace: true });
  }, [token, navigate]);

  const useOtpFlow = otpMode !== 'off';

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { data } = await consumerPortalApi.requestOtp(fhtcNumber.trim(), mobile.trim());
      setStep('otp');
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        setInfo(`Demo OTP: ${data.devOtp} (SMS handoff mode)`);
      } else {
        setInfo('OTP sent to your registered mobile.');
      }
    } catch (err) {
      setError(getLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithOtp(fhtcNumber.trim(), mobile.trim(), otp.trim());
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(getLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(fhtcNumber.trim(), mobile.trim());
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(getLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const primaryButtonSx = {
    mt: 2.5,
    py: 1.45,
    borderRadius: 2.5,
    fontWeight: 700,
    textTransform: 'none' as const,
    fontSize: '1rem',
    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
    backgroundSize: '200% 200%',
    boxShadow: '0 10px 32px rgba(2, 132, 199, 0.4)',
    transition: 'transform 0.2s ease, box-shadow 0.25s ease, background-position 0.4s ease',
    '&:hover': {
      backgroundPosition: '100% 50%',
      boxShadow: '0 14px 40px rgba(2, 132, 199, 0.5)',
      transform: 'translateY(-2px)',
    },
    '&:active': { transform: 'translateY(0)' },
  };

  return (
    <Box sx={{ height: '100vh', maxHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      <StandaloneChrome />
      <LoginAmbientBackground variant="consumer" />

      <Grid container sx={{ height: '100vh', maxHeight: '100vh', flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <Grid
          item
          xs={12}
          md={6}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            px: { md: 4, lg: 5 },
            py: 2.5,
            position: 'relative',
            height: '100vh',
            overflow: 'hidden',
            borderRight: '1px solid rgba(186, 230, 253, 0.5)',
          }}
        >
          <Box sx={{ maxWidth: 520, overflow: 'hidden' }}>
            <Chip
              icon={<WaterDropIcon sx={{ fontSize: 16 }} />}
              label="Uttarakhand Jal Sansthan · Consumer Self-Service"
              size="small"
              sx={{
                mb: 1.5,
                fontWeight: 700,
                bgcolor: 'rgba(255,255,255,0.88)',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                boxShadow: '0 4px 16px rgba(2,132,199,0.1)',
                animation: 'chipFloat 0.8s ease-out',
                '@keyframes chipFloat': {
                  from: { opacity: 0, transform: 'translateY(8px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            />

            <Typography
              variant="h4"
              fontWeight={800}
              sx={{
                color: '#0f172a',
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                mb: 1,
              }}
            >
              Your water account,
              <Box
                component="span"
                sx={{
                  display: 'block',
                  background: 'linear-gradient(90deg, #0284c7, #0d9488)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                one simple portal
              </Box>
            </Typography>

            <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, mb: 2, maxWidth: 460 }}>
              Sign in with your FHTC number and registered mobile to manage bills, complaints,
              and connection requests.
            </Typography>

            <Stack direction="row" spacing={1} mb={2}>
              {[
                { value: '24×7', label: 'Jal Mitra help' },
                { value: '4', label: 'Languages' },
                { value: '100%', label: 'Digital bills' },
              ].map((stat) => (
                <Box
                  key={stat.label}
                  sx={{
                    flex: 1,
                    p: 1,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(186,230,253,0.9)',
                    backdropFilter: 'blur(10px)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0284c7', lineHeight: 1 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Grid container spacing={1.25}>
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Grid item xs={6} key={feature.title}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1.25,
                      height: '100%',
                      borderRadius: 2.5,
                      background: feature.bg,
                      border: '1px solid rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)',
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.9)',
                        color: feature.color,
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </Box>
                    <Box minWidth={0}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#0f172a', display: 'block', lineHeight: 1.3 }}>
                        {feature.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.4, display: 'block', mt: 0.25, fontSize: '0.68rem' }}>
                        {feature.body}
                      </Typography>
                    </Box>
                  </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        </Grid>

        <Grid
          item
          xs={12}
          md={6}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, sm: 2.5, md: 3 },
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          <Card elevation={0} sx={consumerGlassCardSx}>
            <Box
              sx={{
                px: 2.5,
                py: 2,
                textAlign: 'center',
                background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
              }}
            >
              <LoginBrandLogo height={76} />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em', mt: 1.25 }}>
                Online Consumer Portal
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                {APP_BRAND.name} · Self-Service
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#0369a1',
                  display: 'block',
                  mt: 1,
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                बिल, शिकायत और कनेक्शन — एक ही जगह
              </Typography>
            </Box>

            <CardContent sx={{ p: 2.5, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <Box sx={{ display: { xs: 'flex', md: 'none' }, flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                {FEATURES.slice(0, 3).map((feature) => (
                  <Chip
                    key={feature.title}
                    size="small"
                    label={feature.title}
                    sx={{ fontSize: '0.7rem', bgcolor: '#f0f9ff', color: '#0369a1', fontWeight: 600 }}
                  />
                ))}
              </Box>

              <StepIndicator step={step} useOtpFlow={useOtpFlow} />

              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
              {info && <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>{info}</Alert>}

              {step === 'credentials' && (
                <Box
                  component="form"
                  onSubmit={useOtpFlow && otpMode !== 'off' ? handleRequestOtp : handleDirectLogin}
                >
                  <TextField
                    fullWidth
                    required
                    label="FHTC Number"
                    margin="dense"
                    value={fhtcNumber}
                    onChange={(e) => setFhtcNumber(e.target.value)}
                    placeholder="e.g. FHTC-DEMO-001"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={consumerFieldSx}
                  />
                  <TextField
                    fullWidth
                    required
                    label="Registered Mobile"
                    margin="dense"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneAndroidIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={consumerFieldSx}
                  />
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    endIcon={!loading ? <ArrowForwardIcon /> : undefined}
                    sx={primaryButtonSx}
                  >
                    {loading ? 'Please wait…' : useOtpFlow ? 'Send OTP' : 'Sign In'}
                  </Button>
                  {useOtpFlow && otpMode === 'optional' && (
                    <Button
                      fullWidth
                      variant="text"
                      sx={{ mt: 1, textTransform: 'none', fontWeight: 600, color: '#64748b' }}
                      disabled={loading}
                      onClick={handleDirectLogin}
                    >
                      Sign in without OTP
                    </Button>
                  )}
                </Box>
              )}

              {step === 'otp' && (
                <Box component="form" onSubmit={handleVerifyOtp}>
                  <Box
                    sx={{
                      mb: 1.5,
                      p: 1.25,
                      borderRadius: 2,
                      bgcolor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
                      OTP sent to <strong>{mobile}</strong>
                      <br />
                      FHTC <strong>{fhtcNumber}</strong>
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    required
                    label="Enter 6-digit OTP"
                    margin="dense"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PinIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={consumerFieldSx}
                  />
                  {devOtp && (
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: '#f0fdf4',
                        border: '1px dashed #86efac',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700 }}>
                        Demo OTP: {devOtp}
                      </Typography>
                    </Box>
                  )}
                  <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={primaryButtonSx}>
                    {loading ? 'Verifying…' : 'Verify OTP & Sign In'}
                  </Button>
                  <Button
                    fullWidth
                    variant="text"
                    startIcon={<ArrowBackIcon fontSize="small" />}
                    sx={{ mt: 1, textTransform: 'none', fontWeight: 600, color: '#64748b' }}
                    onClick={() => {
                      setStep('credentials');
                      setOtp('');
                      setDevOtp('');
                      setInfo('');
                    }}
                  >
                    Change FHTC / mobile
                  </Button>
                </Box>
              )}

              <Box
                sx={{
                  mt: 2.5,
                  p: 1.5,
                  borderRadius: 2.5,
                  background: 'linear-gradient(135deg, #f8fafc, #f0f9ff)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1.65 }}>
                  <Box component="span" sx={{ color: '#334155', fontWeight: 700 }}>Demo credentials</Box>
                  <br />
                  FHTC: FHTC-DEMO-001 · Mobile: 9876543210
                  {useOtpFlow ? ' · OTP shown on screen in handoff mode' : ''}
                </Typography>
              </Box>

              <Button
                component={RouterLink}
                to="/login"
                fullWidth
                variant="outlined"
                sx={{
                  mt: 2,
                  py: 1.1,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#475569',
                  borderColor: '#e2e8f0',
                  '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
                }}
              >
                Staff login
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
