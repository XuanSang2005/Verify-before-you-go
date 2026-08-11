import type {
  NewsCategory,
  NewsStoryDetail,
  NewsSourceStatus,
} from '@vbyg/contracts';

import type {
  NewsArticle,
  NewsCategory as PrismaNewsCategory,
  NewsSourceStatus as PrismaNewsSourceStatus,
  PrismaClient,
} from '../../generated/prisma/client.js';

export interface NewsRepository {
  list: (category?: NewsCategory) => Promise<NewsStoryDetail[]>;
  findBySlug: (slug: string) => Promise<NewsStoryDetail | null>;
}

const categoryToPrisma: Record<NewsCategory, PrismaNewsCategory> = {
  'hiring-update': 'HIRING_UPDATE',
  'scam-watch': 'SCAM_WATCH',
  guide: 'GUIDE',
  'mil-explainer': 'MIL_EXPLAINER',
};

const categoryFromPrisma: Record<PrismaNewsCategory, NewsCategory> = {
  HIRING_UPDATE: 'hiring-update',
  SCAM_WATCH: 'scam-watch',
  GUIDE: 'guide',
  MIL_EXPLAINER: 'mil-explainer',
};

const sourceStatusFromPrisma: Record<PrismaNewsSourceStatus, NewsSourceStatus> = {
  SYNTHETIC_PROTOTYPE: 'synthetic-prototype',
  SYNTHETIC_SOURCE_LIST: 'synthetic-source-list',
};

function mapNewsArticle(row: NewsArticle): NewsStoryDetail {
  return {
    slug: row.slug,
    category: categoryFromPrisma[row.category],
    title: row.title,
    dek: row.dek,
    eyebrow: row.eyebrow,
    bodySections: row.bodySections,
    verificationSteps: row.verificationSteps,
    sourceNotes: row.sourceNotes,
    sourceStatus: sourceStatusFromPrisma[row.sourceStatus],
    sourceStatusLabel: row.sourceStatusLabel,
    syntheticLabel: 'Synthetic prototype',
    readingMinutes: row.readingMinutes,
    isFeatured: row.isFeatured,
    publishedAt: row.publishedAt.toISOString(),
    reviewedAt: row.reviewedAt.toISOString(),
  };
}

export function createPrismaNewsRepository(prisma: PrismaClient): NewsRepository {
  return {
    async list(category) {
      const rows = await prisma.newsArticle.findMany({
        where: category ? { category: categoryToPrisma[category] } : undefined,
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      });
      return rows.map(mapNewsArticle);
    },
    async findBySlug(slug) {
      const row = await prisma.newsArticle.findUnique({ where: { slug } });
      return row ? mapNewsArticle(row) : null;
    },
  };
}

export const emptyNewsRepository: NewsRepository = {
  list: async () => [],
  findBySlug: async () => null,
};
