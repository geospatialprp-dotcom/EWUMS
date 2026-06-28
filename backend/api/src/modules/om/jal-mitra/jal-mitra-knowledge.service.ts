import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JalMitraKnowledgeArticle } from '../entities/jal-mitra-knowledge-article.entity';
import { JalMitraLang } from './jal-mitra-i18n';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';

const LOCAL_QUERY_SYNONYMS: Record<string, string[]> = {
  bill: ['बिल', 'बैर', 'baki', 'बकाया', 'payment', 'भुगतान'],
  water: ['पाणी', 'पानी', 'pani', 'supply', 'timing'],
  complaint: ['शिकायत', 'समस्या', 'dikkat', 'leak', 'टंकी'],
  tariff: ['टैरिफ', 'दर', 'rate', 'slab', 'खपत'],
  connection: ['कनेक्शन', 'connection', 'fhtc', 'आवेदन'],
};

function expandQueryTerms(query: string, language: JalMitraLang): string[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length >= 2);

  const expanded = [...terms];
  if (language === 'garhwali' || language === 'kumaoni' || language === 'hi') {
    for (const term of terms) {
      for (const synonyms of Object.values(LOCAL_QUERY_SYNONYMS)) {
        if (synonyms.some((s) => s.includes(term) || term.includes(s))) {
          expanded.push(...synonyms);
        }
      }
    }
  }
  return [...new Set(expanded)].slice(0, 12);
}

export type KnowledgeSnippet = {
  id: string;
  category: string;
  title: string;
  content: string;
  language: string;
  score: number;
};

@Injectable()
export class JalMitraKnowledgeService {
  constructor(
    @InjectRepository(JalMitraKnowledgeArticle)
    private kbRepo: Repository<JalMitraKnowledgeArticle>,
  ) {}

  async searchArticles(
    tenantId: string,
    query: string,
    language: JalMitraLang,
    limit = 4,
    options?: { category?: string; minScore?: number },
  ): Promise<KnowledgeSnippet[]> {
    const tid = tenantId || DEMO_TENANT;
    const terms = expandQueryTerms(query, language);

    const langPriority = language === 'hi' || language === 'garhwali' || language === 'kumaoni'
      ? [language, 'hi', 'en']
      : [language, 'en', 'hi'];

    const articles = await this.kbRepo.find({
      where: { tenantId: tid, isActive: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const scored = articles
      .filter((a) => !options?.category || a.category === options.category)
      .map((a) => {
      const hay = `${a.title} ${a.content} ${(a.tags ?? []).join(' ')}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (hay.includes(term)) score += 2;
      }
      const langIdx = langPriority.indexOf(a.language as JalMitraLang);
      if (langIdx >= 0) score += (langPriority.length - langIdx) * 3;
      if (a.category && query.toLowerCase().includes(a.category)) score += 2;
      if (options?.category && a.category === options.category) score += 4;
      return { article: a, score };
    });

    const minScore = options?.minScore ?? 3;
    return scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        id: s.article.id,
        category: s.article.category,
        title: s.article.title,
        content: s.article.content,
        language: s.article.language,
        score: s.score,
      }));
  }

  formatSnippetsForPrompt(snippets: KnowledgeSnippet[]): string {
    if (!snippets.length) return '';
    return snippets
      .map((s, i) => `[${i + 1}] (${s.category}) ${s.title}\n${s.content}`)
      .join('\n\n');
  }
}
