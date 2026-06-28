import { useCallback, useState } from 'react';

import { Box, Chip, Typography } from '@mui/material';

import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';

import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';

import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';

import { Link as RouterLink } from 'react-router-dom';

import PageShell from '../components/layout/PageShell';

import PageHeader from '../components/layout/PageHeader';

import OmBillingStage from '../components/om/OmBillingStage';

import {

  OM_BILLING_REVENUE_REPORTS_1512,

  OM_PAYMENT_MODES,

} from '../constants/omBilling';

import {

  BillingChipRow,

  BillingModuleTracker,

  BillingSectionCard,

  billingHashFromTab,

} from '../components/om/billingUi';



export default function BillingRevenuePage() {

  const [activeTab, setActiveTab] = useState(0);



  const goToModule = useCallback((tab: number) => {

    setActiveTab(tab);

    window.history.replaceState(null, '', `#${billingHashFromTab(tab)}`);

    requestAnimationFrame(() => {

      document.getElementById('billing-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    });

  }, []);



  return (

    <PageShell>

      <PageHeader

        eyebrow="Financial Management"

        title="Billing & Revenue Management"

        subtitle="Consumer billing · meter readings · tariffs · demand & collection · arrears · GIS revenue · ERP accounting · mobile field billing"

        accent="amber"

        leading={<ReceiptLongOutlinedIcon sx={{ fontSize: 36, color: '#d97706', mt: 0.5 }} />}

      />



      <Box

        sx={{

          mb: 2.5,

          p: 2.5,

          borderRadius: 3,

          background: 'linear-gradient(135deg, #451a03 0%, #b45309 42%, #0d9488 100%)',

          color: '#f8fafc',

          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',

        }}

      >

        <Typography variant="overline" sx={{ letterSpacing: '0.14em', fontWeight: 700, color: 'rgba(248,250,252,0.75)' }}>

          Revenue lifecycle

        </Typography>

        <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>

          Accounts → Metering → Billing → Collection → Accounting & Reports

        </Typography>

        <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.85)', mb: 2, maxWidth: 760 }}>

          Click a module below to jump to consumer accounts, bill generation, revenue collection, financial accounting, or revenue reports.

        </Typography>

        <BillingModuleTracker activeTab={activeTab} onModuleSelect={goToModule} />

      </Box>



      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mb={2.5}>

        <BillingSectionCard title="Payment channels" phase="collection">

          <BillingChipRow>

            {OM_PAYMENT_MODES.map((m) => (

              <Chip key={m.code} size="small" color="primary" variant="outlined" label={m.label} />

            ))}

          </BillingChipRow>

        </BillingSectionCard>

        <BillingSectionCard title="Quick access" phase="analytics">

          <BillingChipRow>

            <Chip

              size="small"

              color="secondary"

              icon={<AccountBalanceOutlinedIcon />}

              label="Financial Accounting"

              onClick={() => goToModule(5)}

              clickable

            />

            <Chip

              size="small"

              color="primary"

              icon={<PhoneAndroidOutlinedIcon />}

              label="Mobile Billing"

              component={RouterLink}

              to="/mobile-billing"

              clickable

            />

            <Chip

              size="small"

              color="info"

              icon={<AssessmentOutlinedIcon />}

              label={`Revenue Reports (${OM_BILLING_REVENUE_REPORTS_1512.length})`}

              onClick={() => goToModule(9)}

              clickable

            />

          </BillingChipRow>

        </BillingSectionCard>

      </Box>



      <Box id="billing-workspace" sx={{ scrollMarginTop: '88px' }}>

        <OmBillingStage activeTab={activeTab} onTabChange={setActiveTab} />

      </Box>

    </PageShell>

  );

}


