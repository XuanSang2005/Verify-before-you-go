import type { NewsCategory, NewsStorySummary } from '@vbyg/contracts';

export type NewsFilter = 'all' | NewsCategory;

export const newsFilters: readonly { id: NewsFilter; label: string }[] = [
  { id: 'all', label: 'For you' },
  { id: 'hiring-update', label: 'Hiring' },
  { id: 'scam-watch', label: 'Scam Watch' },
  { id: 'guide', label: 'Guides' },
  { id: 'mil-explainer', label: 'MIL explainers' },
] as const;

export const NEWS_PROTOTYPE_SLUGS = [
  'verify-recruiter-before-fee-or-document',
  'company-impersonation-check-the-channel',
  'seasonal-work-six-fields-to-verify',
  'no-database-match-does-not-mean-safe',
  'read-a-fee-breakdown-before-paying',
  'written-terms-before-travel',
] as const;

const compactCardCopy: Record<string, { title: string; dek: string }> = {
  'verify-recruiter-before-fee-or-document': {
    title: 'Verify a recruiter before fees or documents',
    dek: 'Confirm the legal entity, contact channel and every claimed fee.',
  },
  'company-impersonation-check-the-channel': {
    title: 'Company impersonation: check the sender',
    dek: 'Use the employer’s official contact.',
  },
  'seasonal-work-six-fields-to-verify': {
    title: 'Seasonal work: six fields to verify',
    dek: 'Check employer, role, pay, fees, visa route and application channel.',
  },
  'no-database-match-does-not-mean-safe': {
    title: 'No database match does not mean safe',
    dek: 'A missing entry does not prove safety.',
  },
  'read-a-fee-breakdown-before-paying': {
    title: 'Check fees before paying',
    dek: 'Confirm recipient, amount and refund terms.',
  },
  'written-terms-before-travel': {
    title: 'Get written terms before travel',
    dek: 'Confirm role, location, hours, pay and documents before departure.',
  },
};

export function getCompactNewsCardCopy(story: NewsStorySummary) {
  return compactCardCopy[story.slug] ?? { title: story.title, dek: story.dek };
}

export function shouldUseTwoColumnNewsCards(viewportWidth: number): boolean {
  return viewportWidth >= 700;
}

export function filterNewsStories(
  stories: readonly NewsStorySummary[],
  filter: NewsFilter,
): NewsStorySummary[] {
  return filter === 'all'
    ? [...stories]
    : stories.filter((story) => story.category === filter);
}

export function getNewsCategoryLabel(category: NewsCategory): string {
  return {
    'hiring-update': 'Hiring update',
    'scam-watch': 'Scam Watch',
    guide: 'Guide',
    'mil-explainer': 'MIL explainer',
  }[category];
}

export function formatNewsDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function getNewsMetadata(story: NewsStorySummary): string {
  return `Published ${formatNewsDate(story.publishedAt)} · Reviewed ${formatNewsDate(story.reviewedAt)} · ${story.readingMinutes} min`;
}

export function formatNewsCacheTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
