export type AeVerificationChecks = {
  mbEntriesOk: boolean;
  siteConditionsOk: boolean;
  quantitiesOk: boolean;
  drawingsOk: boolean;
  comments: string;
};

export type EeVerificationChecks = {
  technicalOk: boolean;
  quantityApprovalOk: boolean;
  financialOk: boolean;
  comments: string;
};

export function buildAeVerificationComments(checks: AeVerificationChecks): string {
  const lines = [
    'AE Verification:',
    `- MB entries verified: ${checks.mbEntriesOk ? 'Yes' : 'No'}`,
    `- Site conditions verified: ${checks.siteConditionsOk ? 'Yes' : 'No'}`,
    `- Quantities verified: ${checks.quantitiesOk ? 'Yes' : 'No'}`,
    `- Drawings verified: ${checks.drawingsOk ? 'Yes' : 'No'}`,
  ];
  if (checks.comments.trim()) lines.push(`Notes: ${checks.comments.trim()}`);
  return lines.join('\n');
}

export function buildEeVerificationComments(checks: EeVerificationChecks): string {
  const lines = [
    'EE Final Approval:',
    `- Technical verification: ${checks.technicalOk ? 'Yes' : 'No'}`,
    `- Quantity approval: ${checks.quantityApprovalOk ? 'Yes' : 'No'}`,
    `- Financial approval: ${checks.financialOk ? 'Yes' : 'No'}`,
  ];
  if (checks.comments.trim()) lines.push(`Notes: ${checks.comments.trim()}`);
  return lines.join('\n');
}

export function aeChecksComplete(checks: AeVerificationChecks): boolean {
  return checks.mbEntriesOk && checks.siteConditionsOk && checks.quantitiesOk && checks.drawingsOk;
}

export function eeChecksComplete(checks: EeVerificationChecks): boolean {
  return checks.technicalOk && checks.quantityApprovalOk && checks.financialOk;
}
