import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Divider, Grid, InputAdornment,
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
import { glassCardSx, loginFieldSx, loginPrimaryButtonSx } from '../components/auth/loginPageTheme';
import StandaloneChrome from '../components/layout/StandaloneChrome';
import { useTranslation } from '../context/LanguageContext';
import { getLocale, translate } from '../i18n';


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
  const [forgotOpen, setForgotOpen] = useState(false);
  const { login, token, user } = useAuth();
  const { t } = useTranslation();
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
    setLoading(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      navigate(getDefaultHomePath(loggedInUser.roles), { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const ujsBrand = getDepartmentById(DEFAULT_DEPARTMENT_ID);

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
            <Box sx={{ px: 4, pt: 3, pb: 1, flexShrink: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Box
                  component="img"
                  src={ujsBrand.logoUrl}
                  alt={ujsBrand.logoAlt}
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    p: 0.35,
                    objectFit: 'contain',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                />
                <Box minWidth={0}>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{ color: '#f8fafc', lineHeight: 1.15, letterSpacing: '-0.02em', fontSize: '1.35rem' }}
                  >
                    {ujsBrand.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.35, letterSpacing: '0.04em' }}>
                    {ujsBrand.nameHi ? `${ujsBrand.nameHi}  ·  ` : ''}{APP_BRAND.name} · Government of Uttarakhand
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ mb: 1.5 }}>
                <LoginKpiStats />
              </Box>

              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ display: { md: 'none', lg: 'flex' } }}>
                {['GIS', 'Projects', 'O&M', 'Billing', 'Analytics'].map((label) => (
                  <Box
                    key={label}
                    sx={{
                      px: 1,
                      py: 0.35,
                      borderRadius: 1,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      color: '#cbd5e1',
                      border: '1px solid rgba(148, 163, 184, 0.22)',
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {label}
                  </Box>
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
                px: 3,
                pt: 2.5,
                pb: 2,
                textAlign: 'center',
                bgcolor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
              }}
            >
              <LoginBrandLogo height={72} />
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{ color: '#0f172a', letterSpacing: '-0.02em', mt: 1.5, fontSize: '1.125rem' }}
              >
                Staff sign-in
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: '#64748b', mt: 0.5, lineHeight: 1.5, display: 'block', maxWidth: 280, mx: 'auto' }}
              >
                {APP_BRAND.name} · {APP_BRAND.headerTitle}
              </Typography>
            </Box>

            <Box sx={{ display: { xs: 'block', md: 'none' }, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <LoginHeroShowcase compact />
              <LoginPipelineStrip compact />
            </Box>

            <CardContent sx={{ p: 3, pt: 2.5, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {apiStatus && <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>{apiStatus}</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>{error}</Alert>}

              <Stack
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{
                  mb: 2,
                  px: 1.25,
                  py: 0.65,
                  borderRadius: 1,
                  bgcolor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                }}
              >
                <LockIcon sx={{ fontSize: 15, color: '#0F4C81' }} />
                <Typography
                  variant="caption"
                  sx={{ color: '#334155', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.65rem' }}
                >
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
                    sx={{ textTransform: 'none', color: '#0F4C81', fontWeight: 600, minWidth: 0, p: 0.5 }}
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
                  sx={loginPrimaryButtonSx}
                >
                  {loading ? t('auth.signingIn') : t('auth.signInToBrand', { brand: APP_BRAND.name })}
                </Button>
              </form>

              <Box
                sx={{
                  mt: 2,
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <VerifiedUserOutlinedIcon sx={{ fontSize: 17, color: '#64748b', mt: 0.1 }} />
                <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                  {t('auth.authorizedOnly')}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }}>
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
                  py: 1.1,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#0F4C81',
                  borderColor: '#cbd5e1',
                  bgcolor: '#ffffff',
                  '&:hover': {
                    bgcolor: '#f8fafc',
                    borderColor: '#0F4C81',
                  },
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
