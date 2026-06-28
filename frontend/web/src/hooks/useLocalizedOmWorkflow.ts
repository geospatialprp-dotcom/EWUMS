import { useMemo } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { OM_WORKFLOW_STAGES, type OmWorkflowStage } from '../constants/omWorkflow';
import { translate, translateList } from '../i18n';

export function useLocalizedOmWorkflowStages(): OmWorkflowStage[] {
  const { locale } = useTranslation();

  return useMemo(
    () =>
      OM_WORKFLOW_STAGES.map((stage) => {
        const base = `om.stages.${stage.key}`;
        const steps = translateList(locale, `${base}.steps`);
        return {
          ...stage,
          name: translate(locale, `${base}.name`) || stage.name,
          summary: translate(locale, `${base}.summary`) || stage.summary,
          steps: steps.length ? steps : stage.steps,
        };
      }),
    [locale],
  );
}

export function usePageCopy(pageKey: keyof typeof import('../i18n/locales/en').en.pages) {
  const { t } = useTranslation();
  return {
    eyebrow: t(`pages.${pageKey}.eyebrow`),
    title: t(`pages.${pageKey}.title`),
    subtitle: t(`pages.${pageKey}.subtitle`),
  };
}
