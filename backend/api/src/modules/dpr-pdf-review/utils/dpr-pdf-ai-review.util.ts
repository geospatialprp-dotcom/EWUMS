import pdfParse from 'pdf-parse';
import {
  DPR_PDF_AI_SEVERITY_COLORS,
  DprPdfAiCategory,
  DprPdfAiSeverity,
} from '../constants/dpr-pdf-ai-review.constants';

export type DprPdfAiFindingRect = { x: number; y: number; w: number; h: number };

export type DprPdfAiFinding = {
  pageNumber: number;
  severity: DprPdfAiSeverity;
  category: DprPdfAiCategory;
  ruleId: string;
  title: string;
  message: string;
  snippet: string;
  rect: DprPdfAiFindingRect;
};

export type DprPdfAiReviewResult = {
  pageCount: number;
  findings: DprPdfAiFinding[];
  summary: {
    total: number;
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
};

type PageSlice = { pageNumber: number; text: string };

const APPROVAL_BLOCKS: Array<{
  label: string;
  ruleId: string;
  severity: DprPdfAiSeverity;
  requireSe?: boolean;
}> = [
  { label: 'APPROVED BY', ruleId: 'sig_missing_approver', severity: 'critical', requireSe: true },
  { label: 'CHECKED BY', ruleId: 'sig_missing_checker', severity: 'major' },
  { label: 'PREPARED BY', ruleId: 'sig_missing_preparer', severity: 'minor' },
  { label: 'VERIFIED BY', ruleId: 'sig_missing_verifier', severity: 'major' },
];

const SIGNATURE_INDICATORS =
  /signed|signature|digitally\s+signed|e-?sign|thumb\s+impression|authorised\s+signatory/i;

const SE_INDICATORS =
  /superintending\s+engineer|\(s\.?\s*e\.?\)|\bse\b|s\.?\s*e\.?\s*\(/i;

const TYPO_PATTERNS: Array<{ wrong: RegExp; correct: string; ruleId: string }> = [
  { wrong: /\brecieve\b/gi, correct: 'receive', ruleId: 'grammar_typo_recieve' },
  { wrong: /\bseperate\b/gi, correct: 'separate', ruleId: 'grammar_typo_seperate' },
  { wrong: /\boccured\b/gi, correct: 'occurred', ruleId: 'grammar_typo_occured' },
  { wrong: /\bdefinately\b/gi, correct: 'definitely', ruleId: 'grammar_typo_definately' },
  { wrong: /\bgoverment\b/gi, correct: 'government', ruleId: 'grammar_typo_goverment' },
  { wrong: /\benviroment\b/gi, correct: 'environment', ruleId: 'grammar_typo_enviroment' },
];

const DPR_COMPLIANCE_KEYWORDS: Array<{ keyword: RegExp; label: string; severity: DprPdfAiSeverity }> = [
  { keyword: /detailed\s+project\s+report/i, label: 'Detailed Project Report', severity: 'critical' },
  { keyword: /executive\s+summary/i, label: 'Executive Summary', severity: 'major' },
  { keyword: /bill\s+of\s+quantities|boq/i, label: 'Bill of Quantities (BOQ)', severity: 'major' },
  { keyword: /scope\s+of\s+work/i, label: 'Scope of Work', severity: 'minor' },
  { keyword: /environmental\s+clearance|eia/i, label: 'Environmental clearance / EIA', severity: 'info' },
];

const LAKH_VALUE = /([\d,]+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)/i;
const CRORE_VALUE = /([\d,]+(?:\.\d+)?)\s*(?:crore|crores|cr\.?)/i;

function parseIndianAmount(text: string): number | null {
  const lakh = LAKH_VALUE.exec(text);
  if (lakh) return parseFloat(lakh[1].replace(/,/g, ''));
  const crore = CRORE_VALUE.exec(text);
  if (crore) return parseFloat(crore[1].replace(/,/g, '')) * 100;
  const plain = /([\d,]+(?:\.\d+)?)/.exec(text);
  if (plain) return parseFloat(plain[1].replace(/,/g, ''));
  return null;
}

function estimateRect(charIndex: number, pageLength: number): DprPdfAiFindingRect {
  const yNorm = pageLength > 0 ? charIndex / pageLength : 0.5;
  return {
    x: 0.08,
    y: Math.min(0.88, yNorm * 0.9 + 0.04),
    w: 0.55,
    h: 0.06,
  };
}

function snippetAround(text: string, index: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function pushFinding(
  findings: DprPdfAiFinding[],
  seen: Set<string>,
  finding: DprPdfAiFinding,
) {
  const key = `${finding.pageNumber}|${finding.ruleId}|${finding.snippet.slice(0, 40)}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push(finding);
}

export async function parsePdfToPages(buffer: Buffer): Promise<PageSlice[]> {
  const parsed = await pdfParse(buffer);
  const fullText = parsed.text ?? '';
  const pageCount = Math.max(parsed.numpages ?? 1, 1);

  if (fullText.includes('\f')) {
    const parts = fullText.split('\f');
    return parts.map((text: string, i: number) => ({
      pageNumber: i + 1,
      text: text.trim(),
    }));
  }

  const chunkSize = Math.ceil(fullText.length / pageCount) || fullText.length;
  const pages: PageSlice[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    const start = i * chunkSize;
    pages.push({
      pageNumber: i + 1,
      text: fullText.slice(start, start + chunkSize).trim(),
    });
  }
  return pages;
}

function checkApprovalSignatures(page: PageSlice, findings: DprPdfAiFinding[], seen: Set<string>) {
  const upper = page.text.toUpperCase();
  for (const block of APPROVAL_BLOCKS) {
    let searchFrom = 0;
    while (searchFrom < upper.length) {
      const idx = upper.indexOf(block.label, searchFrom);
      if (idx === -1) break;
      searchFrom = idx + block.label.length;

      const context = page.text.slice(idx, idx + 500);
      const afterLabel = page.text.slice(idx + block.label.length, idx + 450);
      const hasSignature = SIGNATURE_INDICATORS.test(context);
      const hasPersonName = /[A-Z][A-Za-z]{2,}\s+[A-Z][A-Za-z]{2,}/.test(afterLabel);
      const isBlankBlock = /^[\s_:.\-–—]{0,30}$/.test(afterLabel.slice(0, 40));

      if (isBlankBlock || (!hasSignature && !hasPersonName)) {
        pushFinding(findings, seen, {
          pageNumber: page.pageNumber,
          severity: block.severity,
          category: 'signature',
          ruleId: isBlankBlock ? 'sig_blank_block' : block.ruleId,
          title: `Missing signature — ${block.label}`,
          message: isBlankBlock
            ? `The ${block.label} block appears blank with no name or signature.`
            : `No signature or signatory name detected near ${block.label}.`,
          snippet: snippetAround(page.text, idx),
          rect: estimateRect(idx, page.text.length),
        });
      }

      if (block.requireSe && !SE_INDICATORS.test(context)) {
        pushFinding(findings, seen, {
          pageNumber: page.pageNumber,
          severity: 'critical',
          category: 'signature',
          ruleId: 'sig_missing_se_approver',
          title: 'Missing SE signature on APPROVED BY',
          message:
            'APPROVED BY block found but Superintending Engineer (SE) designation or signature is not present.',
          snippet: snippetAround(page.text, idx),
          rect: estimateRect(idx, page.text.length),
        });
      }
    }
  }
}

function checkNumericalMismatch(page: PageSlice, findings: DprPdfAiFinding[], seen: Set<string>) {
  const costOfRe = /cost\s+of\s+[\w\s]{2,40}?[:\s]+([\d,.]+\s*(?:lakh|lakhs|lac|lacs|crore|crores|cr\.?)?)/gi;
  const totalCostRe = /total\s+cost[\w\s]*[:\s]+([\d,.]+\s*(?:lakh|lakhs|lac|lacs|crore|crores|cr\.?)?)/gi;

  const costMatches: Array<{ value: number; index: number; raw: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = costOfRe.exec(page.text)) !== null) {
    const val = parseIndianAmount(m[1]);
    if (val != null) costMatches.push({ value: val, index: m.index, raw: m[0] });
  }

  const totalMatches: Array<{ value: number; index: number; raw: string }> = [];
  while ((m = totalCostRe.exec(page.text)) !== null) {
    const val = parseIndianAmount(m[1]);
    if (val != null) totalMatches.push({ value: val, index: m.index, raw: m[0] });
  }

  if (costMatches.length === 0 || totalMatches.length === 0) return;

  const sumCosts = costMatches.reduce((s, c) => s + c.value, 0);
  const lastTotal = totalMatches[totalMatches.length - 1];
  const tolerance = Math.max(sumCosts * 0.02, 0.5);
  if (Math.abs(sumCosts - lastTotal.value) > tolerance) {
    pushFinding(findings, seen, {
      pageNumber: page.pageNumber,
      severity: 'major',
      category: 'numerical',
      ruleId: 'num_cost_total_mismatch',
      title: 'Cost total mismatch',
      message: `Sum of "Cost of …" line items (~${sumCosts.toFixed(2)} Lakh) does not match stated Total cost (${lastTotal.value.toFixed(2)} Lakh).`,
      snippet: `${costMatches.map((c) => c.raw).join('; ')} | ${lastTotal.raw}`,
      rect: estimateRect(lastTotal.index, page.text.length),
    });
  }
}

function checkCrossReferences(
  pages: PageSlice[],
  findings: DprPdfAiFinding[],
  seen: Set<string>,
) {
  const fullDoc = pages.map((p) => p.text).join('\n');
  const refRe =
    /(?:refer\s+(?:to\s+)?|see\s+|as\s+per\s+)?(?:annexure|annex|table|figure|fig\.?)\s+([IVXivx\d]+(?:\.\d+)?)/gi;

  const referenced = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = refRe.exec(fullDoc)) !== null) {
    referenced.add(m[1].toLowerCase());
  }

  for (const ref of referenced) {
    const presentRe = new RegExp(
      `(?:annexure|annex|table|figure|fig\\.?)\\s+${ref.replace('.', '\\.')}`,
      'i',
    );
    if (!presentRe.test(fullDoc)) {
      const pageIdx = pages.findIndex((p) =>
        new RegExp(`(?:annexure|table|figure|fig\\.?)\\s+${ref}`, 'i').test(p.text),
      );
      pushFinding(findings, seen, {
        pageNumber: pageIdx >= 0 ? pages[pageIdx].pageNumber : 1,
        severity: 'minor',
        category: 'cross_reference',
        ruleId: 'xref_missing_annexure',
        title: `Referenced annexure/table not found`,
        message: `Document references "${ref}" but a matching annexure/table/figure heading was not detected.`,
        snippet: `Reference to annexure/table ${ref}`,
        rect: { x: 0.1, y: 0.15, w: 0.5, h: 0.05 },
      });
    }
  }
}

function checkComplianceKeywords(
  pages: PageSlice[],
  findings: DprPdfAiFinding[],
  seen: Set<string>,
) {
  const fullDoc = pages.map((p) => p.text).join('\n');
  for (const item of DPR_COMPLIANCE_KEYWORDS) {
    if (!item.keyword.test(fullDoc)) {
      pushFinding(findings, seen, {
        pageNumber: 1,
        severity: item.severity,
        category: 'compliance',
        ruleId: `compliance_missing_${item.label.toLowerCase().replace(/\s+/g, '_')}`,
        title: `Missing DPR section: ${item.label}`,
        message: `Expected DPR compliance keyword "${item.label}" was not found in the document.`,
        snippet: item.label,
        rect: { x: 0.1, y: 0.1, w: 0.6, h: 0.05 },
      });
    }
  }
}

function checkTypos(page: PageSlice, findings: DprPdfAiFinding[], seen: Set<string>) {
  for (const typo of TYPO_PATTERNS) {
    const re = new RegExp(typo.wrong.source, typo.wrong.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(page.text)) !== null) {
      pushFinding(findings, seen, {
        pageNumber: page.pageNumber,
        severity: 'minor',
        category: 'grammar',
        ruleId: typo.ruleId,
        title: `Possible typo: "${m[0]}"`,
        message: `Consider "${typo.correct}" instead of "${m[0]}".`,
        snippet: snippetAround(page.text, m.index, 50),
        rect: estimateRect(m.index, page.text.length),
      });
    }
  }
}

function checkPageNumbering(pages: PageSlice[], findings: DprPdfAiFinding[], seen: Set<string>) {
  const pageNumRe = /page\s+(\d+)\s+of\s+(\d+)/gi;
  const detected: number[] = [];
  for (const page of pages) {
    let m: RegExpExecArray | null;
    while ((m = pageNumRe.exec(page.text)) !== null) {
      detected.push(parseInt(m[1], 10));
    }
  }
  if (detected.length < 2) return;
  const sorted = [...new Set(detected)].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] > 1) {
      pushFinding(findings, seen, {
        pageNumber: sorted[i - 1],
        severity: 'info',
        category: 'formatting',
        ruleId: 'fmt_page_number_gap',
        title: 'Page numbering gap detected',
        message: `Page numbers jump from ${sorted[i - 1]} to ${sorted[i]}.`,
        snippet: `Pages ${sorted[i - 1]} → ${sorted[i]}`,
        rect: { x: 0.35, y: 0.95, w: 0.3, h: 0.03 },
      });
    }
  }
}

function checkFormattingIssues(page: PageSlice, findings: DprPdfAiFinding[], seen: Set<string>) {
  const placeholderRe = /_{5,}|\.{5,}|\[?\s*to\s+be\s+filled\s*\]?/gi;
  let m: RegExpExecArray | null;
  while ((m = placeholderRe.exec(page.text)) !== null) {
    const nearApproval = /approved|checked|prepared|verified/i.test(
      page.text.slice(Math.max(0, m.index - 60), m.index + 60),
    );
    if (!nearApproval) continue;
    pushFinding(findings, seen, {
      pageNumber: page.pageNumber,
      severity: 'major',
      category: 'formatting',
      ruleId: 'fmt_blank_approval_placeholder',
      title: 'Blank approval placeholder',
      message: 'Approval block contains unfilled placeholder lines.',
      snippet: snippetAround(page.text, m.index, 60),
      rect: estimateRect(m.index, page.text.length),
    });
  }
}

export async function runDprPdfAiReview(buffer: Buffer): Promise<DprPdfAiReviewResult> {
  const pages = await parsePdfToPages(buffer);
  const findings: DprPdfAiFinding[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    checkApprovalSignatures(page, findings, seen);
    checkNumericalMismatch(page, findings, seen);
    checkTypos(page, findings, seen);
    checkFormattingIssues(page, findings, seen);
  }

  checkCrossReferences(pages, findings, seen);
  checkComplianceKeywords(pages, findings, seen);
  checkPageNumbering(pages, findings, seen);

  const summary = {
    total: findings.length,
    critical: findings.filter((f) => f.severity === 'critical').length,
    major: findings.filter((f) => f.severity === 'major').length,
    minor: findings.filter((f) => f.severity === 'minor').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };

  return { pageCount: pages.length, findings, summary };
}

export function getAiSeverityColor(severity: DprPdfAiSeverity): string {
  return DPR_PDF_AI_SEVERITY_COLORS[severity];
}
