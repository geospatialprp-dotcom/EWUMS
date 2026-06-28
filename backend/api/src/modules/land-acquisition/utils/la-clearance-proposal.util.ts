import {
  findStatutoryClearance,
  LA_STATUTORY_CLEARANCES,
  mapLegacyClearanceType,
} from '../constants/la-statutory-clearances.constants';
import type { LaClearanceItem } from '../entities/la.entities';

export type ClearanceChecklistItem = {
  clearanceCode: string;
  clearanceLabel: string;
  item: string;
  completed: boolean;
};

export type ClearanceFormItem = {
  code: string;
  name: string;
  clearanceCode: string;
  clearanceLabel: string;
  status: 'pending' | 'drafted' | 'submitted' | 'approved';
};

export type ClearanceDocumentItem = {
  code: string;
  name: string;
  clearanceCode: string;
  clearanceLabel: string;
  status: 'pending' | 'uploaded' | 'verified';
};

export type ClearanceProposalPackage = {
  proposalNo: string;
  title: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'approved';
  generatedAt: string;
  clearancesRequired: Array<{
    code: string;
    label: string;
    authority: string;
    count: number;
    approvalStatus: string;
  }>;
  checklist: ClearanceChecklistItem[];
  forms: ClearanceFormItem[];
  documents: ClearanceDocumentItem[];
  approvalSummary: {
    total: number;
    approved: number;
    pending: number;
    applied: number;
  };
};

export function buildClearanceProposalPackage(
  caseNo: string,
  caseTitle: string,
  items: LaClearanceItem[],
): ClearanceProposalPackage {
  const typeCounts = new Map<string, { count: number; statuses: Set<string> }>();

  for (const item of items) {
    const code = mapLegacyClearanceType(item.clearanceType);
    const entry = typeCounts.get(code) ?? { count: 0, statuses: new Set<string>() };
    entry.count += 1;
    entry.statuses.add(item.status);
    typeCounts.set(code, entry);
  }

  const clearancesRequired = [...typeCounts.entries()].map(([code, meta]) => {
    const def = findStatutoryClearance(code);
    const statuses = [...meta.statuses];
    const approvalStatus = statuses.includes('approved')
      ? 'approved'
      : statuses.includes('applied')
        ? 'applied'
        : 'required';
    return {
      code,
      label: def?.label ?? code,
      authority: def?.authority ?? '',
      count: meta.count,
      approvalStatus,
    };
  });

  const checklist: ClearanceChecklistItem[] = [];
  const forms: ClearanceFormItem[] = [];
  const documents: ClearanceDocumentItem[] = [];
  const formSeen = new Set<string>();
  const docSeen = new Set<string>();

  for (const req of clearancesRequired) {
    const def = findStatutoryClearance(req.code);
    if (!def) continue;
    for (const item of def.checklist) {
      checklist.push({
        clearanceCode: def.code,
        clearanceLabel: def.label,
        item,
        completed: false,
      });
    }
    for (const form of def.forms) {
      const key = `${def.code}:${form.code}`;
      if (formSeen.has(key)) continue;
      formSeen.add(key);
      forms.push({
        ...form,
        clearanceCode: def.code,
        clearanceLabel: def.label,
        status: 'pending',
      });
    }
    for (const doc of def.documents) {
      const key = `${def.code}:${doc.code}`;
      if (docSeen.has(key)) continue;
      docSeen.add(key);
      documents.push({
        ...doc,
        clearanceCode: def.code,
        clearanceLabel: def.label,
        status: 'pending',
      });
    }
  }

  const approved = items.filter((i) => i.status === 'approved').length;
  const applied = items.filter((i) => i.status === 'applied').length;
  const pending = items.filter((i) => !['approved', 'not_applicable'].includes(i.status)).length;

  return {
    proposalNo: `CL-${caseNo}`,
    title: `Statutory Clearance Proposal — ${caseTitle}`,
    status: approved === items.length && items.length > 0 ? 'approved' : items.length ? 'in_progress' : 'draft',
    generatedAt: new Date().toISOString(),
    clearancesRequired,
    checklist,
    forms,
    documents,
    approvalSummary: {
      total: items.length,
      approved,
      pending,
      applied,
    },
  };
}

export function enrichClearanceDetails(clearanceType: string): Record<string, unknown> {
  const code = mapLegacyClearanceType(clearanceType);
  const def = findStatutoryClearance(code);
  if (!def) return {};
  return {
    statutoryCode: def.code,
    checklist: def.checklist,
    forms: def.forms,
    documents: def.documents,
  };
}

export function detectClearancesFromParcel(input: {
  landUse?: string | null;
  landClass?: string | null;
  ownershipClassification?: string | null;
  attributes?: Record<string, unknown>;
}): string[] {
  const blob = [
    input.landUse,
    input.landClass,
    input.ownershipClassification,
    JSON.stringify(input.attributes ?? {}),
  ].join(' ').toLowerCase();

  const hits = new Set<string>();

  if (input.ownershipClassification) {
    for (const def of LA_STATUTORY_CLEARANCES) {
      if (def.parcelOwnership.includes(input.ownershipClassification)) {
        hits.add(def.code);
      }
    }
  }

  for (const def of LA_STATUTORY_CLEARANCES) {
    if (def.parcelPatterns.some((p) => p.test(blob))) {
      hits.add(def.code);
    }
  }

  return [...hits];
}
