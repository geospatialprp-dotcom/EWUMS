import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import StandaloneChrome from '../components/layout/StandaloneChrome';
import ConsumerPortalStage from '../components/portal/ConsumerPortalStage';
import JalMitraChat from '../components/portal/JalMitraChat';
import { usePageCopy } from '../hooks/useLocalizedOmWorkflow';

export default function ConsumerPortalPage() {
  const page = usePageCopy('consumerPortal');

  return (
    <PageShell>
      <StandaloneChrome />
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        subtitle={page.subtitle}
        accent="violet"
      />
      <ConsumerPortalStage />
      <JalMitraChat />
    </PageShell>
  );
}
