import type {
  NewsDetailResponse,
  NewsListQuery,
  NewsListResponse,
  NewsStorySummary,
} from '@vbyg/contracts';

import type { NewsRepository } from './news.repository.js';

export const SYNTHETIC_NEWS_NOTICE =
  'These stories are synthetic prototype content, not live reporting or official advice.' as const;

export class NewsStoryNotFoundError extends Error {
  constructor() {
    super('The requested synthetic newsroom story was not found.');
    this.name = 'NewsStoryNotFoundError';
  }
}

export async function listNewsStories(
  repository: NewsRepository,
  query: NewsListQuery,
  now: () => Date = () => new Date(),
): Promise<NewsListResponse> {
  const stories = await repository.list(query.category);
  const summaries: NewsStorySummary[] = stories.map((story) => ({
    slug: story.slug,
    category: story.category,
    title: story.title,
    dek: story.dek,
    sourceStatus: story.sourceStatus,
    sourceStatusLabel: story.sourceStatusLabel,
    syntheticLabel: story.syntheticLabel,
    readingMinutes: story.readingMinutes,
    isFeatured: story.isFeatured,
    publishedAt: story.publishedAt,
    reviewedAt: story.reviewedAt,
  }));
  return {
    stories: summaries,
    fetchedAt: now().toISOString(),
    syntheticContentNotice: SYNTHETIC_NEWS_NOTICE,
  };
}

export async function getNewsStory(
  repository: NewsRepository,
  slug: string,
): Promise<NewsDetailResponse> {
  const story = await repository.findBySlug(slug);
  if (!story) throw new NewsStoryNotFoundError();
  return { story };
}
