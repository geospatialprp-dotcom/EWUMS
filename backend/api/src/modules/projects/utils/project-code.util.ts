export const PROJECT_CODE_PREFIX = 'PRJ';
/** e.g. PRJ-TPPWSS-2026-27 — initials must be letters only */
export const PROJECT_CODE_PATTERN = /^PRJ-[A-Z]{2,10}-\d{4}-\d{2}(?:-\d+)?$/;

/** Indian FY (Apr–Mar) as 2026-27 */
export function getIndianFinancialYearRange(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/** Display label e.g. FY 2026-27 */
export function formatIndianFinancialYearLabel(date = new Date()): string {
  return `FY ${getIndianFinancialYearRange(date)}`;
}

/** First letter of each word in the project name. */
export function initialsFromProjectName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^A-Za-z]/g, '').charAt(0))
    .filter((ch) => /[A-Za-z]/.test(ch))
    .join('')
    .toUpperCase()
    .slice(0, 10);
}

/** PRJ-{initials}-{FY} e.g. PRJ-MWSS-2026-27 */
export function buildProjectCodeFromName(name: string, date = new Date()): string {
  const initials = initialsFromProjectName(name);
  const fy = getIndianFinancialYearRange(date);
  if (!initials) return `${PROJECT_CODE_PREFIX}-${fy}`;
  return `${PROJECT_CODE_PREFIX}-${initials}-${fy}`;
}

export function isValidProjectCode(value: string): boolean {
  return PROJECT_CODE_PATTERN.test(value.trim().toUpperCase());
}
