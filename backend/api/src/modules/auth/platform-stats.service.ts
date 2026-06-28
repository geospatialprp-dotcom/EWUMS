import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type PlatformLoginStats = {
  modules: number;
  gisAssets: number;
  divisions: number;
  projects: number;
  updatedAt: string;
  live: boolean;
};

const DEFAULT_STATS: PlatformLoginStats = {
  modules: 20,
  gisAssets: 0,
  divisions: 13,
  projects: 0,
  updatedAt: new Date().toISOString(),
  live: false,
};

@Injectable()
export class PlatformStatsService {
  constructor(private readonly dataSource: DataSource) {}

  async getLoginStats(): Promise<PlatformLoginStats> {
    const stats: PlatformLoginStats = {
      ...DEFAULT_STATS,
      updatedAt: new Date().toISOString(),
      live: false,
    };

    try {
      const table = await this.dataSource.query<{ reg: string | null }[]>(
        `SELECT to_regclass('public.divisions')::text AS reg`,
      );
      if (table?.[0]?.reg) {
        const [row] = await this.dataSource.query<{ c: number }[]>(
          `SELECT COUNT(*)::int AS c
           FROM divisions
           WHERE status = 'active'
             AND COALESCE(is_headquarters, false) = false`,
        );
        if (typeof row?.c === 'number') stats.divisions = row.c;
        stats.live = true;
      }
    } catch {
      // keep default divisions
    }

    try {
      const gisTables = await this.dataSource.query<{ pf: string | null; ca: string | null }[]>(
        `SELECT
           to_regclass('public.project_features')::text AS pf,
           to_regclass('public.construction_assets')::text AS ca`,
      );
      const pf = gisTables?.[0]?.pf;
      const ca = gisTables?.[0]?.ca;
      let gisAssets = 0;
      if (pf) {
        const [row] = await this.dataSource.query<{ c: number }[]>(
          'SELECT COUNT(*)::int AS c FROM project_features',
        );
        gisAssets += row?.c ?? 0;
      }
      if (ca) {
        const [row] = await this.dataSource.query<{ c: number }[]>(
          'SELECT COUNT(*)::int AS c FROM construction_assets',
        );
        gisAssets += row?.c ?? 0;
      }
      stats.gisAssets = gisAssets;
      if (pf || ca) stats.live = true;
    } catch {
      // keep default gisAssets
    }

    try {
      const table = await this.dataSource.query<{ reg: string | null }[]>(
        `SELECT to_regclass('public.projects')::text AS reg`,
      );
      if (table?.[0]?.reg) {
        const [row] = await this.dataSource.query<{ c: number }[]>(
          `SELECT COUNT(*)::int AS c FROM projects WHERE status <> 'archived'`,
        );
        if (typeof row?.c === 'number') stats.projects = row.c;
        stats.live = true;
      }
    } catch {
      // optional
    }

    stats.updatedAt = new Date().toISOString();
    return stats;
  }
}
