export interface DepartmentBrand {
  id: string;
  name: string;
  nameHi?: string;
  shortName: string;
  logoUrl: string;
  logoAlt: string;
}

/** Department logos shown in the app header — Uttarakhand Jal Sansthan is the default. */
export const DEPARTMENT_BRANDS: DepartmentBrand[] = [
  {
    id: 'ujs',
    name: 'Uttarakhand Jal Sansthan',
    nameHi: 'उत्तराखण्ड जल संस्थान',
    shortName: 'UJS',
    logoUrl: '/departments/uttarakhand-jal-sansthan.png',
    logoAlt: 'Uttarakhand Jal Sansthan',
  },
  {
    id: 'upjn',
    name: 'Uttarakhand Peyjal Nigam',
    shortName: 'UPJN',
    logoUrl: '/departments/uttarakhand-peyjal-nigam.svg',
    logoAlt: 'Uttarakhand Peyjal Nigam',
  },
  {
    id: 'upcl',
    name: 'Uttarakhand Power Corporation Ltd.',
    shortName: 'UPCL',
    logoUrl: '/departments/uttarakhand-power-corporation.svg',
    logoAlt: 'Uttarakhand Power Corporation Ltd.',
  },
  {
    id: 'uid',
    name: 'Uttarakhand Irrigation Department',
    shortName: 'UID',
    logoUrl: '/departments/uttarakhand-irrigation.svg',
    logoAlt: 'Uttarakhand Irrigation Department',
  },
];

export const DEFAULT_DEPARTMENT_ID = 'ujs';

export const DEPARTMENT_STORAGE_KEY = 'egcms_department_id';

export function getDepartmentById(id: string): DepartmentBrand {
  return DEPARTMENT_BRANDS.find((d) => d.id === id) ?? DEPARTMENT_BRANDS[0];
}
