import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import type { NewsDetailResponse, NewsListResponse, NewsStorySummary } from '@vbyg/contracts';

import { NewsApiError } from '@/api/news';

import { CompactNewsStoryCard, NewsFilterControls } from './NewsroomScreen';
import {
  useNewsroom,
  useNewsStory,
  type NewsLoaderDependencies,
} from './use-news';
import type { NewsFilter } from './news-model';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function FilterHarness() {
  const [value, setValue] = useState<NewsFilter>('all');
  return <NewsFilterControls onChange={setValue} value={value} />;
}

const detail: NewsDetailResponse = {
  story: {
    slug: 'retry-story',
    category: 'guide',
    title: 'Retry loaded this synthetic story.',
    dek: 'Synthetic guidance.',
    eyebrow: 'Guide · Demo',
    bodySections: ['Check independently.'],
    verificationSteps: ['Find an official source.'],
    sourceNotes: ['Synthetic prototype content.'],
    sourceStatus: 'synthetic-prototype',
    sourceStatusLabel: 'Synthetic pattern only',
    syntheticLabel: 'Synthetic prototype',
    readingMinutes: 3,
    isFeatured: false,
    publishedAt: '2026-08-03T02:00:00.000Z',
    reviewedAt: '2026-08-08T02:00:00.000Z',
  },
};

const compactStory: NewsStorySummary = {
  slug: 'seasonal-work-six-fields-to-verify',
  category: 'hiring-update',
  title: 'Seasonal-work notice: six fields to verify before applying.',
  dek: 'Employer, role, pay, fees, visa route and official application channel.',
  sourceStatus: 'synthetic-source-list',
  sourceStatusLabel: 'Demo source list reviewed',
  syntheticLabel: 'Synthetic prototype',
  readingMinutes: 3,
  isFeatured: false,
  publishedAt: '2026-08-01T02:00:00.000Z',
  reviewedAt: '2026-08-07T02:00:00.000Z',
};

const list: NewsListResponse = {
  stories: [compactStory],
  fetchedAt: '2026-08-10T02:00:00.000Z',
  syntheticContentNotice: 'These stories are synthetic prototype content, not live reporting or official advice.',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

function RetryHarness({ dependencies }: { dependencies: NewsLoaderDependencies }) {
  const story = useNewsStory('retry-story', dependencies);
  return (
    <div>
      <output data-testid="retry-status">{story.status}</output>
      <output data-testid="retry-title">{story.response?.story.title ?? ''}</output>
      <output data-testid="retry-message">{story.message ?? ''}</output>
      <output data-testid="retry-refreshing">{String(Boolean(story.refreshing))}</output>
      <button data-testid="retry-control" disabled={story.refreshing} onClick={story.retry} type="button">Retry</button>
    </div>
  );
}

function ListRetryHarness({ dependencies }: { dependencies: NewsLoaderDependencies }) {
  const newsroom = useNewsroom(dependencies);
  return (
    <div>
      <output data-testid="list-retry-status">{newsroom.status}</output>
      <output data-testid="list-retry-message">{newsroom.message ?? ''}</output>
      <output data-testid="list-retry-refreshing">{String(Boolean(newsroom.refreshing))}</output>
      <button data-testid="list-retry-control" disabled={newsroom.refreshing} onClick={newsroom.retry} type="button">Retry</button>
    </div>
  );
}

describe('CP07 rendered newsroom interactions', () => {
  it('exposes filters as toggle buttons and supports keyboard selection', async () => {
    const harness = await mount(<FilterHarness />);
    const all = harness.container.querySelector<HTMLElement>('[data-testid="news-filter-all"]');
    const hiring = harness.container.querySelector<HTMLElement>('[data-testid="news-filter-hiring-update"]');
    if (!all || !hiring) throw new Error('News filters were not rendered');

    expect(all.getAttribute('role')).toBe('button');
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(hiring.getAttribute('aria-pressed')).toBe('false');

    await act(async () => hiring.focus());
    expect(document.activeElement).toBe(hiring);
    await act(async () => {
      hiring.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
      }));
    });

    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(hiring.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(hiring);
    await cleanup(harness.container, harness.root);
  });

  it('retry performs a fresh request and replaces an error state with content', async () => {
    let fetchCalls = 0;
    const dependencies: NewsLoaderDependencies = {
      deleteDetailCache: async () => undefined,
      fetchDetail: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          throw new NewsApiError({ kind: 'network', message: 'Connection unavailable.' });
        }
        return detail;
      },
      fetchList: async () => { throw new Error('Not used'); },
      loadDetailCache: async () => null,
      loadListCache: async () => null,
      saveDetailCache: async () => undefined,
      saveListCache: async () => undefined,
    };
    const harness = await mount(<RetryHarness dependencies={dependencies} />);
    await settle();
    expect(harness.container.querySelector('[data-testid="retry-status"]')?.textContent).toBe('error');

    const retry = harness.container.querySelector<HTMLElement>('[data-testid="retry-control"]');
    if (!retry) throw new Error('Retry control was not rendered');
    await act(async () => retry.click());
    await settle();

    expect(fetchCalls).toBe(2);
    expect(harness.container.querySelector('[data-testid="retry-status"]')?.textContent).toBe('ready');
    expect(harness.container.querySelector('[data-testid="retry-title"]')?.textContent).toContain('Retry loaded');
    await cleanup(harness.container, harness.root);
  });

  it('keeps the cached list offline disclosure visible while retry is pending', async () => {
    const pending = createDeferred<NewsListResponse>();
    let fetchCalls = 0;
    const dependencies: NewsLoaderDependencies = {
      deleteDetailCache: async () => undefined,
      fetchDetail: async () => { throw new Error('Not used'); },
      fetchList: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) throw new NewsApiError({ kind: 'network', message: 'Offline.' });
        return pending.promise;
      },
      loadDetailCache: async () => null,
      loadListCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-10T03:00:00.000Z', data: list }),
      saveDetailCache: async () => undefined,
      saveListCache: async () => undefined,
    };
    const harness = await mount(<ListRetryHarness dependencies={dependencies} />);
    await settle();
    expect(harness.container.querySelector('[data-testid="list-retry-status"]')?.textContent).toBe('offline');
    expect(harness.container.querySelector('[data-testid="list-retry-message"]')?.textContent).toBe('Offline · showing saved summaries');

    const retry = harness.container.querySelector<HTMLButtonElement>('[data-testid="list-retry-control"]');
    if (!retry) throw new Error('List retry control was not rendered');
    await act(async () => retry.click());
    await settle();

    expect(fetchCalls).toBe(2);
    expect(harness.container.querySelector('[data-testid="list-retry-status"]')?.textContent).toBe('offline');
    expect(harness.container.querySelector('[data-testid="list-retry-message"]')?.textContent).toBe('Offline · showing saved summaries');
    expect(harness.container.querySelector('[data-testid="list-retry-refreshing"]')?.textContent).toBe('true');
    expect(retry.disabled).toBe(true);

    await act(async () => pending.resolve(list));
    await settle();
    expect(harness.container.querySelector('[data-testid="list-retry-status"]')?.textContent).toBe('ready');
    await cleanup(harness.container, harness.root);
  });

  it('keeps the cached detail service disclosure visible while retry is pending', async () => {
    const pending = createDeferred<NewsDetailResponse>();
    let fetchCalls = 0;
    const dependencies: NewsLoaderDependencies = {
      deleteDetailCache: async () => undefined,
      fetchDetail: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          throw new NewsApiError({ kind: 'http', message: 'Service unavailable.', status: 500 });
        }
        return pending.promise;
      },
      fetchList: async () => { throw new Error('Not used'); },
      loadDetailCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-10T03:00:00.000Z', data: detail }),
      loadListCache: async () => null,
      saveDetailCache: async () => undefined,
      saveListCache: async () => undefined,
    };
    const harness = await mount(<RetryHarness dependencies={dependencies} />);
    await settle();
    expect(harness.container.querySelector('[data-testid="retry-status"]')?.textContent).toBe('service-unavailable');
    expect(harness.container.querySelector('[data-testid="retry-message"]')?.textContent).toBe('Service unavailable · showing saved copy');

    const retry = harness.container.querySelector<HTMLButtonElement>('[data-testid="retry-control"]');
    if (!retry) throw new Error('Detail retry control was not rendered');
    await act(async () => retry.click());
    await settle();

    expect(fetchCalls).toBe(2);
    expect(harness.container.querySelector('[data-testid="retry-status"]')?.textContent).toBe('service-unavailable');
    expect(harness.container.querySelector('[data-testid="retry-message"]')?.textContent).toBe('Service unavailable · showing saved copy');
    expect(harness.container.querySelector('[data-testid="retry-refreshing"]')?.textContent).toBe('true');
    expect(retry.disabled).toBe(true);

    await act(async () => pending.resolve(detail));
    await settle();
    expect(harness.container.querySelector('[data-testid="retry-status"]')?.textContent).toBe('ready');
    await cleanup(harness.container, harness.root);
  });

  it('renders the compact Screen 18 card hierarchy without list-only source metadata', async () => {
    const harness = await mount(<CompactNewsStoryCard story={compactStory} twoColumn={false} />);
    const card = harness.container.querySelector<HTMLElement>('[data-testid="news-card-seasonal-work-six-fields-to-verify"]');
    const title = harness.container.querySelector<HTMLElement>('[data-testid="news-card-title-seasonal-work-six-fields-to-verify"]');
    const dek = harness.container.querySelector<HTMLElement>('[data-testid="news-card-dek-seasonal-work-six-fields-to-verify"]');
    if (!card || !title || !dek) throw new Error('Compact news card was not rendered');

    expect(harness.container.textContent).toContain('Seasonal work: six fields to verify');
    expect(harness.container.textContent).toContain('Check employer, role, pay, fees, visa route and application channel.');
    expect(harness.container.textContent).not.toContain('Synthetic demo');
    expect(harness.container.textContent).not.toContain('Demo source list reviewed');
    expect(harness.container.textContent).not.toContain('Published');
    expect(harness.container.textContent).not.toContain('Reviewed');
    expect(card.getAttribute('aria-label')).not.toContain('Synthetic demo');
    expect(card.getAttribute('aria-label')).not.toContain('Demo source list reviewed');

    const cardStyle = window.getComputedStyle(card);
    expect(cardStyle.minHeight).toBe('105px');
    expect(cardStyle.paddingTop).toBe('12px');
    expect(cardStyle.gap).toBe('10px');
    expect(window.getComputedStyle(title).fontSize).toBe('14px');

    await cleanup(harness.container, harness.root);
  });

  it('keeps an intrinsic half-width card at the 768px tablet breakpoint', async () => {
    const harness = await mount(<CompactNewsStoryCard story={compactStory} twoColumn />);
    const card = harness.container.querySelector<HTMLElement>('[data-testid="news-card-seasonal-work-six-fields-to-verify"]');
    if (!card) throw new Error('Compact tablet news card was not rendered');
    const style = window.getComputedStyle(card);
    expect(style.flexBasis).toBe('48%');
    expect(style.flexGrow).toBe('0');
    await cleanup(harness.container, harness.root);
  });
});
