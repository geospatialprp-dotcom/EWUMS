import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import ConsumerComplaintsWorkspace from '../components/om/ConsumerComplaintsWorkspace';
import { useTranslation } from '../context/LanguageContext';

export default function ConsumerComplaintsPage() {
  const { t } = useTranslation();

  return (
    <PageShell>
      <PageHeader
        eyebrow={t('complaints.eyebrow')}
        title={t('complaints.pageTitle')}
        subtitle={t('complaints.pageSubtitle')}
        accent="rose"
        leading={<ReportProblemOutlinedIcon sx={{ fontSize: 36, color: '#e11d48', mt: 0.5 }} />}
        actions={(
          <Button
            component={RouterLink}
            to="/om#complaints"
            variant="outlined"
            size="small"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {t('complaints.openInOm')}
          </Button>
        )}
      />

      <Box
        sx={{
          mb: 2.5,
          p: 2.5,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #b45309 100%)',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',
        }}
      >
        <Typography variant="body2" sx={{ color: '#e2e8f0', maxWidth: 720 }}>
          {t('complaints.heroBlurb')}
        </Typography>
      </Box>

      <ConsumerComplaintsWorkspace />
    </PageShell>
  );
}
