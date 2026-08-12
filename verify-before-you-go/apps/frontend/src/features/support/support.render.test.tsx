import { act, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportDirectoryScreen } from './SupportDirectoryScreen';

const actionMocks = vi.hoisted(() => ({
  retry: vi.fn(),
  saveOffline: vi.fn(),
}));

const clipboardMock = vi.hoisted(() => vi.fn(async (): Promise<boolean | void> => true));

const stateFixture = vi.hoisted(() => ({
  mode: 'ready' as 'ready' | 'offline' | 'bundle' | 'error',
}));

const directoryResponse = {
  schemaVersion: 1 as const,
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.' as const,
  contacts: [
    {
      id: 'support-cambodia-1288',
      country: 'cambodia' as const,
      countryLabel: 'Cambodia',
      kind: 'emergency' as const,
      title: 'Anti-trafficking hotline, Cambodia',
      description: 'Human-trafficking reporting short code.',
      displayValue: '1288',
      actionUri: 'tel:1288',
      actionLabel: 'Call 1288',
      accessMode: 'cellular' as const,
      accessLabel: 'No data · cellular service required',
      dataStatus: 'reviewed-reference' as const,
      dataStatusLabel: 'Reviewed emergency reference',
      sourceOwner: 'Telecommunication Regulator of Cambodia',
      sourceUrl: 'https://www.trc.gov.kh/en/resources/emergency-numbers/',
      languages: [],
      languageStatus: 'unconfirmed' as const,
      hours: 'Availability not independently confirmed',
      lastReviewedAt: '2026-08-12T00:00:00.000Z',
      nextReviewAt: '2026-09-12T00:00:00.000Z',
      reviewStatus: 'current' as const,
      sortOrder: 10,
    },
    {
      id: 'support-cambodia-chab-dai',
      country: 'cambodia' as const,
      countryLabel: 'Cambodia',
      kind: 'organization' as const,
      title: 'Someone to help you get out and home',
      description: 'Open the official contact page for current support information.',
      displayValue: 'Chab Dai Coalition',
      actionUri: 'https://www.chabdai.org/contact',
      actionLabel: 'Open Chab Dai',
      accessMode: 'internet' as const,
      accessLabel: 'Internet connection required',
      dataStatus: 'reviewed-reference' as const,
      dataStatusLabel: 'Reviewed organization reference',
      sourceOwner: 'Chab Dai Coalition',
      sourceUrl: 'https://www.chabdai.org/contact',
      languages: ['English'],
      languageStatus: 'confirmed' as const,
      hours: 'Response hours not confirmed',
      lastReviewedAt: '2026-08-12T00:00:00.000Z',
      nextReviewAt: '2026-09-12T00:00:00.000Z',
      reviewStatus: 'current' as const,
      sortOrder: 20,
    },
    {
      id: 'support-vietnam-111',
      country: 'vietnam' as const,
      countryLabel: 'Viet Nam',
      kind: 'emergency' as const,
      title: 'National protection hotline, Viet Nam',
      description: 'National protection and human-trafficking reporting hotline.',
      displayValue: '111',
      actionUri: 'tel:111',
      actionLabel: 'Call 111',
      accessMode: 'cellular' as const,
      accessLabel: 'No data · cellular service required',
      dataStatus: 'reviewed-reference' as const,
      dataStatusLabel: 'Reviewed emergency reference',
      sourceOwner: 'Viet Nam National Hotline 111',
      sourceUrl: 'https://tongdai111.vn/tin/tong-dai-dien-thoai-quoc-gia-ve-phong-chong-mua-ban-nguoi-la-so111',
      languages: ['Vietnamese'],
      languageStatus: 'confirmed' as const,
      hours: 'Availability not independently confirmed',
      lastReviewedAt: '2026-08-12T00:00:00.000Z',
      nextReviewAt: '2026-09-12T00:00:00.000Z',
      reviewStatus: 'current' as const,
      sortOrder: 10,
    },
  ],
};

vi.mock('expo-router', () => ({
  Link: ({ asChild, children, href }: { asChild?: boolean; children: ReactNode; href: string }) => {
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, { href });
    }
    return <a href={href}>{children}</a>;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: clipboardMock,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

vi.mock('./use-support-directory', () => ({
  useSupportDirectory: () => {
    if (stateFixture.mode === 'bundle') {
      return {
        bundledAt: '2026-08-12T00:00:00.000Z',
        fallbackKind: 'bundle' as const,
        fallbackNotice: 'Bundled contacts were reviewed on the date shown. Verify availability again when you have a connection.',
        message: 'Offline · showing bundled contacts',
        response: directoryResponse,
        retry: actionMocks.retry,
        saveOffline: actionMocks.saveOffline,
        savedOffline: false,
        status: 'offline' as const,
      };
    }
    if (stateFixture.mode === 'offline') {
      return {
        cachedAt: '2026-08-12T01:00:00.000Z',
        message: 'Offline · showing saved contacts',
        response: directoryResponse,
        retry: actionMocks.retry,
        saveOffline: actionMocks.saveOffline,
        savedOffline: true,
        status: 'offline' as const,
      };
    }
    if (stateFixture.mode === 'error') {
      return {
        message: 'The directory could not be reached.',
        retry: actionMocks.retry,
        saveOffline: actionMocks.saveOffline,
        status: 'error' as const,
      };
    }
    return {
      response: directoryResponse,
      retry: actionMocks.retry,
      saveOffline: actionMocks.saveOffline,
      savedOffline: true,
      status: 'ready' as const,
    };
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderAtWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SupportDirectoryScreen mascotSource={{ uri: 'help-wheelchair-screen08.jpg' }} />);
    await Promise.resolve();
  });
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

beforeEach(() => {
  stateFixture.mode = 'ready';
  actionMocks.retry.mockClear();
  actionMocks.saveOffline.mockClear();
  clipboardMock.mockReset();
  clipboardMock.mockResolvedValue(true);
});

describe.each([360, 390, 768, 1024])('CP14 rendered support directory at %ipx', (width) => {
  it('keeps the headerless Screen 08 hierarchy, exact mascot stage and 48px controls', async () => {
    const harness = await renderAtWidth(width);
    expect(harness.container.querySelector('[role="heading"]')?.textContent).toBe('Get help');
    expect(harness.container.textContent).not.toContain('Verify Before You Go');
    expect(harness.container.querySelector('[data-testid="support-screen08-mascot-stage"] img')).not.toBeNull();
    expect(harness.container.textContent).toContain('Reviewed references show a dated source check.');
    expect(harness.container.textContent).toContain('No data');
    expect(harness.container.textContent).toContain('Internet required · Opens official source');
    expect(harness.container.textContent).toContain('Emergency');
    expect(harness.container.textContent).toContain('Embassy / Consular');
    expect(harness.container.textContent).toContain('Organizations');

    const interactive = harness.container.querySelectorAll<HTMLElement>('[role="button"], [role="link"]');
    for (const control of interactive) {
      const minHeight = Number.parseFloat(window.getComputedStyle(control).minHeight);
      expect(minHeight || 48).toBeGreaterThanOrEqual(48);
    }
    expect(harness.container.scrollWidth).toBeLessThanOrEqual(harness.container.clientWidth || width);
    await cleanup(harness.container, harness.root);
  });
});

it('keeps copy disclosure honest when Clipboard resolves false or rejects', async () => {
  const harness = await renderAtWidth(390);
  const copy = harness.container.querySelector<HTMLElement>('[aria-label="Copy 1288"]');
  if (!copy) throw new Error('Copy action did not render');

  clipboardMock.mockResolvedValueOnce(false);
  await act(async () => copy.click());
  expect(harness.container.textContent).toContain('Could not copy this contact.');
  expect(harness.container.textContent).not.toContain('1288 copied.');

  clipboardMock.mockRejectedValueOnce(new Error('denied'));
  await act(async () => copy.click());
  expect(harness.container.textContent).toContain('Could not copy this contact.');
  await cleanup(harness.container, harness.root);
});

it('filters Cambodia and Viet Nam locally without removing explicit status distinctions', async () => {
  const harness = await renderAtWidth(390);
  const cambodia = harness.container.querySelector<HTMLElement>('[data-testid="support-country-cambodia"]');
  const vietnam = harness.container.querySelector<HTMLElement>('[data-testid="support-country-vietnam"]');
  if (!cambodia || !vietnam) throw new Error('Country controls did not render');
  expect(cambodia.getAttribute('aria-pressed')).toBe('true');
  expect(harness.container.textContent).toContain('1288');
  expect(harness.container.textContent).not.toContain('National protection hotline, Viet Nam');

  await act(async () => vietnam.click());
  expect(vietnam.getAttribute('aria-pressed')).toBe('true');
  expect(harness.container.textContent).toContain('111');
  expect(harness.container.textContent).not.toContain('1288');
  await cleanup(harness.container, harness.root);
});

it('country selector activates from Enter and Space with a visible focusable button', async () => {
  const harness = await renderAtWidth(390);
  const cambodia = harness.container.querySelector<HTMLElement>('[data-testid="support-country-cambodia"]');
  const vietnam = harness.container.querySelector<HTMLElement>('[data-testid="support-country-vietnam"]');
  if (!cambodia || !vietnam) throw new Error('Country controls did not render');
  const keyboard = userEvent.setup({ document });

  await act(async () => {
    vietnam.focus();
    await keyboard.keyboard('{Enter}');
  });
  expect(document.activeElement).toBe(vietnam);
  expect(vietnam.getAttribute('aria-pressed')).toBe('true');

  await act(async () => {
    cambodia.focus();
    await keyboard.keyboard(' ');
  });
  expect(document.activeElement).toBe(cambodia);
  expect(cambodia.getAttribute('aria-pressed')).toBe('true');
  await cleanup(harness.container, harness.root);
});

it('keeps saved-copy disclosure visible offline and exposes retry and offline-save actions', async () => {
  stateFixture.mode = 'offline';
  const harness = await renderAtWidth(390);
  expect(harness.container.textContent).toContain('Offline · showing saved contacts');
  expect(harness.container.textContent).toContain('Saved on this device');
  const retry = harness.container.querySelector<HTMLElement>('[aria-label="Retry support directory"]');
  const save = harness.container.querySelector<HTMLElement>('[aria-label="Save contacts offline again"]');
  if (!retry || !save) throw new Error('Offline controls did not render');
  await act(async () => retry.click());
  await act(async () => save.click());
  expect(actionMocks.retry).toHaveBeenCalledOnce();
  expect(actionMocks.saveOffline).toHaveBeenCalledOnce();
  await cleanup(harness.container, harness.root);
});

it('discloses the bundled review date and need to recheck availability on first-run offline', async () => {
  stateFixture.mode = 'bundle';
  const harness = await renderAtWidth(390);
  expect(harness.container.textContent).toContain('Offline · showing bundled contacts');
  expect(harness.container.textContent).toContain('Bundled review Aug 12, 2026');
  expect(harness.container.textContent).toContain('Verify availability again when you have a connection.');
  expect(harness.container.textContent).toContain('Included with this app');
  await cleanup(harness.container, harness.root);
});

it('renders an accessible failure heading, safety copy and route to How it works', async () => {
  stateFixture.mode = 'error';
  const failed = await renderAtWidth(390);
  expect(failed.container.querySelectorAll('[role="heading"]')[1]?.textContent).toBe('Support directory unavailable');
  expect(failed.container.textContent).toContain('locally verified emergency service');
  await cleanup(failed.container, failed.root);

  stateFixture.mode = 'ready';
  const ready = await renderAtWidth(390);
  const link = ready.container.querySelector<HTMLElement>('[aria-label="How the support directory works"]');
  expect(link?.getAttribute('href')).toBe('/how-it-works');
  await cleanup(ready.container, ready.root);
});
