/** Single source of truth for S2T2R product naming (user-facing). */
export const APP_BRAND = {
  /** Short product name */
  name: 'S2T2R',
  /** PRP Geospatial corporate logo (public/prp-logo.png) */
  logoUrl: '/prp-logo.png',
  logoAlt: 'PRP Geospatial Solutions',
  companyName: 'PRP Geospatial Solutions',
  companyUrl: 'https://www.prpgeospatial.com',
  /** Top app bar */
  headerTitle: 'Enterprises Water Utility Management System',
  /** Shorter title for narrow mobile headers */
  headerTitleShort: 'EWUMS · Water Utility System',
  /** Login subtitle */
  tagline: 'Integrated water supply planning, O&M, billing, GIS, and analytics on one platform',
  /** Browser tab title */
  pageTitle: 'S2T2R — Enterprises Water Utility Management System',
  /** Sidebar brand eyebrow */
  sidebarEyebrow: 'Water Utility Management',
  /** Short company label for sidebar link */
  sidebarCompanyShort: 'PRP Geospatial',
  /** HTML meta description */
  description:
    'S2T2R — Enterprises Water Utility Management System — 20 integrated modules for planning, construction, GIS, O&M, billing, finance, and analytics.',
} as const;
