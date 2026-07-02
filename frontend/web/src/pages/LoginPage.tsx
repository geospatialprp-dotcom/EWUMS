import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, InputAdornment,
  Stack, TextField, Typography,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockIcon from '@mui/icons-material/Lock';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getDefaultHomePath } from '../utils/roleNavigation';
import { APP_BRAND } from '../constants/branding';
import LoginHeroShowcase from '../components/auth/LoginHeroShowcase';
import LoginPipelineStrip from '../components/auth/LoginPipelineShowcase';
import ForgotPasswordDialog from '../components/auth/ForgotPasswordDialog';
import LoginAmbientBackground from '../components/auth/LoginAmbientBackground';
import LoginKpiStats from '../components/auth/LoginKpiStats';
import LoginBrandLogo from '../components/branding/LoginBrandLogo';
import { getDepartmentById, DEFAULT_DEPARTMENT_ID } from '../constants/departments';
import { glassCardSx, loginFieldSx } from '../components/auth/loginPageTheme';
import StandaloneChrome from '../components/layout/StandaloneChrome';
import { useTranslation } from '../context/LanguageContext';
import { captureLoginGeolocation } from '../utils/captureLoginGeolocation';
import { getLocale, translate, translateList } from '../i18n';


function formatApiMessage(message: unknown): string | undefined {
  if (!message) return undefined;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  return undefined;
}

function getLoginErrorMessage(err: unknown): string {
  const locale = getLocale();
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return translate(locale, 'auth.backendUnreachable');
    }
    const status = err.response.status;
    const apiMessage = formatApiMessage(err.response.data?.message);
    if (status === 400) return apiMessage ?? translate(locale, 'auth.invalidFormat');
    if (status === 401) return translate(locale, 'auth.invalidCredentials');
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      return translate(locale, 'auth.databaseError');
    }
    return apiMessage ?? translate(locale, 'auth.loginFailedHttp', { status });
  }
  if (err instanceof Error) return err.message;
  return translate(locale, 'auth.loginFailed');
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const { login, token, user } = useAuth();
  const { t, locale } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate(getDefaultHomePath(user?.roles), { replace: true });
  }, [token, user?.roles, navigate]);

  useEffect(() => {
    fetch('/api/v1/auth/login', { method: 'OPTIONS' })
      .then(() => setApiStatus(''))
      .catch(() => setApiStatus(t('auth.backendNotRunning')));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLocationNotice('');
    setLoading(true);
    try {
      const geo = await captureLoginGeolocation();
      if (!geo) {
        setLocationNotice(
          'Location permission was not granted. Audit trail will record approximate IP-based location only. Allow location access for pinpoint GPS accuracy.',
        );
      }
      const loggedInUser = await login(email.trim(), password, geo ?? undefined);
      navigate(getDefaultHomePath(loggedInUser.roles), { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const ujsBrand = getDepartmentById(DEFAULT_DEPARTMENT_ID);
  const moduleChips = translateList(locale, 'auth.moduleChips');

  return (
    <Box sx={{ height: '100vh', maxHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      <StandaloneChrome />
      <LoginAmbientBackground variant="staff" />

      <Grid container sx={{ height: '100vh', maxHeight: '100vh', flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <Grid
          item
          xs={12}
          md={6}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            height: '100vh',
            borderRight: '1px solid rgba(148, 163, 184, 0.12)',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <Box sx={{ px: 4, pt: 2.5, pb: 0.5, flexShrink: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} mb={1.5}>
                <Box
                  component="img"
                  src={ujsBrand.logoUrl}
                  alt={ujsBrand.logoAlt}
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    p: 0.25,
                    objectFit: 'contain',
                    boxShadow: '0 8px 24px rgba(2, 132, 199, 0.25)',
                  }}
                />
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#f8fafc', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                    {ujsBrand.shortName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.35 }}>
                    {ujsBrand.nameHi ?? ujsBrand.name} · {APP_BRAND.name}
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ mb: 1 }}>
                <LoginKpiStats />
              </Box>

              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ display: { md: 'none', lg: 'flex' } }}>
                <Chip
                  size="small"
                  icon={<VerifiedUserOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                  label="Enterprise platform"
                  sx={{
                    height: 26,
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    bgcolor: 'rgba(37, 99, 235, 0.2)',
                    color: '#93c5fd',
                    border: '1px solid rgba(147, 197, 253, 0.35)',
                  }}
                />
                {moduleChips.map((label) => (
                  <Chip
                    key={label}
                    size="small"
                    label={label}
                    sx={{
                      height: 26,
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      color: '#94a3b8',
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                    }}
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <LoginHeroShowcase />
              </Box>
              <LoginPipelineStrip />
            </Box>
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
          <Card elevation={0} sx={glassCardSx()}>
            <Box
              sx={{
                px: 2.5,
                py: 2,
                textAlign: 'center',
                background: 'linear-gradient(180deg, rgba(248,250,252,0.95) 0%, #ffffff 100%)',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
              }}
            >
              <LoginBrandLogo height={76} />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em', mt: 1.25 }}>
                {t('auth.welcomeBack')}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, lineHeight: 1.45, display: 'block', maxWidth: 300, mx: 'auto' }}>
                {APP_BRAND.name} · {APP_BRAND.headerTitle}
              </Typography>
            </Box>

            <Box sx={{ display: { xs: 'block', md: 'none' }, bgcolor: '#f8fafc' }}>
              <LoginHeroShowcase compact />
              <LoginPipelineStrip compact />
            </Box>

            <CardContent sx={{ p: 2.5, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {apiStatus && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{apiStatus}</Alert>}
              {locationNotice && <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>{locationNotice}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  mb: 1.5,
                  px: 1,
                  py: 0.6,
                  borderRadius: 2,
                  bgcolor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                }}
              >
                <LockIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {t('auth.staffSignIn')}
                </Typography>
              </Stack>

              <form onSubmit={handleSubmit} noValidate>
                <TextField
                  fullWidth
                  label={t('auth.email')}
                  type="text"
                  autoComplete="username"
                  margin="dense"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@department.gov.in"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={loginFieldSx}
                />
                <TextField
                  fullWidth
                  label={t('auth.password')}
                  type="password"
                  autoComplete="current-password"
                  margin="dense"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={loginFieldSx}
                />
                <Box display="flex" justifyContent="flex-end" mt={0.5}>
                  <Button
                    size="small"
                    sx={{ textTransform: 'none', color: '#2563eb', fontWeight: 600, minWidth: 0, p: 0.5 }}
                    onClick={() => setForgotOpen(true)}
                  >
                    Forgot password?
                  </Button>
                </Box>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  endIcon={!loading ? <ArrowForwardIcon /> : undefined}
                  sx={{
                    mt: 2,
                    py: 1.2,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '1rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 40%, #1d4ed8 100%)',
                    backgroundSize: '200% 200%',
                    boxShadow: '0 10px 32px rgba(37, 99, 235, 0.45)',
                    transition: 'transform 0.2s ease, box-shadow 0.25s ease, background-position 0.4s ease',
                    '&:hover': {
                      backgroundPosition: '100% 50%',
                      boxShadow: '0 14px 40px rgba(37, 99, 235, 0.55)',
                      transform: 'translateY(-2px)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  {loading ? t('auth.signingIn') : t('auth.signInToBrand', { brand: APP_BRAND.name })}
                </Button>
              </form>

              <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <VerifiedUserOutlinedIcon sx={{ fontSize: 18, color: '#64748b', mt: 0.15 }} />
                <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.65 }}>
                  {t('auth.authorizedOnly')}
                </Typography>
              </Box>

              <Divider sx={{ my: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', px: 1, fontWeight: 600 }}>
                  or
                </Typography>
              </Divider>

              <Button
                component={RouterLink}
                to="/portal/login"
                fullWidth
                variant="outlined"
                sx={{
                  py: 1.2,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#0284c7',
                  borderColor: '#bae6fd',
                  bgcolor: '#f0f9ff',
                  background: 'linear-gradient(180deg, #f0f9ff, #ffffff)',
                  '&:hover': { bgcolor: '#e0f2fe', borderColor: '#7dd3fc', transform: 'translateY(-1px)' },
                  transition: 'all 0.2s ease',
                }}
              >
                Consumer portal sign-in
              </Button>
            </CardContent>
          </Card>

          <ForgotPasswordDialog
            open={forgotOpen}
            initialEmail={email}
            onClose={() => setForgotOpen(false)}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
