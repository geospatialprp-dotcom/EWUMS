export interface PipelineShowcaseItem {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  accent: string;
  accentSoft: string;
  typicalUse: string;
}

/** Water-supply pipeline types — replace images in public/pipelines/ with site photos when available. */
export const PIPELINE_SHOWCASE: PipelineShowcaseItem[] = [
  {
    id: 'gi',
    code: 'GI',
    name: 'Galvanized Iron Pipeline',
    subtitle: 'House service & distribution lines',
    description: 'Lightweight GI mains for lateral connections, service lines, and low-pressure distribution in hilly terrain.',
    imageUrl: '/pipelines/gi-pipeline.jpg',
    accent: '#0284c7',
    accentSoft: '#7dd3fc',
    typicalUse: '15 mm – 100 mm dia',
  },
  {
    id: 'mserw',
    code: 'MSERW',
    name: 'Mild Steel ERW Pipeline',
    subtitle: 'Rising main & pumping lines',
    description: 'Electric-resistance welded MS pipes for pumping mains, river crossings, and medium-pressure transmission.',
    imageUrl: '/pipelines/mserw-pipeline.jpg',
    accent: '#475569',
    accentSoft: '#94a3b8',
    typicalUse: '100 mm – 450 mm dia',
  },
  {
    id: 'di',
    code: 'DI',
    name: 'Ductile Iron Pipeline',
    subtitle: 'Gravity main & bulk supply',
    description: 'High-strength DI gravity mains for bulk water transfer, valve chambers, and long-life trunk networks.',
    imageUrl: '/pipelines/di-pipeline.jpg',
    accent: '#0369a1',
    accentSoft: '#38bdf8',
    typicalUse: '100 mm – 600 mm dia',
  },
];

export const PIPELINE_ROTATE_MS = 5500;
