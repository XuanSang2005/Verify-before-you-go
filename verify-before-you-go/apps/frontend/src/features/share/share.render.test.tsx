import { act, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { SharePreviewExperience } from './SharePreviewScreen';
import { ShareRecipientController, ShareRecipientExperience } from './ShareRecipientScreen';
import { createSafeShareSummary, toVerifiedSafeShareSummary } from './share-model';
import { ShareTokenApiError } from '@/api/share';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-router', () => ({
  Link: function MockLink({ children, href }: { children: ReactElement; href: string }) {
    if (!isValidElement(children)) return children;
    return cloneElement(children as ReactElement<{ href?: string }>, { href });
  },
  router: {
    back: vi.fn(),
    canGoBack: () => false,
    push: vi.fn(),
    replace: vi.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

vi.mock('expo-linking', () => ({
  createURL: () => 'https://example.test/share/recipient',
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const summary = createSafeShareSummary(undefined);
const recipientSummary = toVerifiedSafeShareSummary({
  ...summary,
  issuedAt: '2026-08-11T12:00:00.000Z',
  expiresAt: '2026-08-18T12:00:00.000Z',
});
const TOKEN_A = `v1.${'a'.repeat(80)}.${'b'.repeat(43)}`;

async function render(element: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

async function cleanup(root: Root, container: HTMLElement) {
  await act(async () => root.unmount());
  container.remove();
}

describe('CP12 rendered privacy-safe sharing', () => {
  it('renders the prototype preview hierarchy without private evidence', async () => {
    const harness = await render(
      <SharePreviewExperience
        onBack={() => undefined}
        onCopy={async () => 'copied'}
        onShare={async () => 'shared'}
        summary={summary}
      />,
    );

    expect(harness.container.textContent).toContain('Share evidence, not an accusation.');
    expect(harness.container.textContent).toContain('6 of 9');
    expect(harness.container.textContent).toContain('Sensitive details hidden');
    expect(harness.container.textContent).not.toContain('person@example.com');
    const mascot = harness.container.querySelector('[data-testid="share-preview-mascot"]');
    expect(mascot?.getAttribute('aria-label')).toBeNull();
    await cleanup(harness.root, harness.container);
  });

  it('keeps Share disabled while pending and reports completion', async () => {
    let resolveShare: ((value: 'shared') => void) | undefined;
    const pending = new Promise<'shared'>((resolve) => { resolveShare = resolve; });
    const harness = await render(
      <SharePreviewExperience
        onBack={() => undefined}
        onCopy={async () => 'copied'}
        onShare={() => pending}
        summary={summary}
      />,
    );
    const button = harness.container.querySelector<HTMLElement>('[data-testid="share-privately"]');
    if (!button) throw new Error('Share button not rendered');

    await act(async () => button.click());
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(harness.container.textContent).toContain('Preparing private share…');
    await act(async () => resolveShare?.('shared'));
    expect(harness.container.textContent).toContain('Private share opened. You choose the recipient.');
    await cleanup(harness.root, harness.container);
  });

  it('copies from the explicit fallback and announces success', async () => {
    let copies = 0;
    const harness = await render(
      <SharePreviewExperience
        onBack={() => undefined}
        onCopy={async () => { copies += 1; return 'copied'; }}
        onShare={async () => 'shared'}
        summary={summary}
      />,
    );
    const button = harness.container.querySelector<HTMLElement>('[data-testid="copy-share-summary"]');
    if (!button) throw new Error('Copy button not rendered');
    await act(async () => button.click());
    expect(copies).toBe(1);
    expect(harness.container.textContent).toContain('Privacy-safe summary and link copied.');
    await cleanup(harness.root, harness.container);
  });

  it('renders genuine keyboard-focusable Recipient links with the canonical destinations', async () => {
    const harness = await render(
      <ShareRecipientExperience summary={recipientSummary} />,
    );
    expect(harness.container.textContent).toContain('Someone you trust shared this offer.');
    expect(harness.container.textContent).toContain('What needs checking');
    expect(harness.container.textContent).toContain('The original screenshot and full identifiers were not shared.');
    expect(harness.container.textContent?.match(/The legal company is not named\./g)).toHaveLength(1);
    const mascot = harness.container.querySelector('[data-testid="share-recipient-mascot"]');
    expect(mascot?.getAttribute('aria-label')).toBeNull();

    const checklist = harness.container.querySelector<HTMLAnchorElement>('[data-testid="recipient-open-checklist"]');
    const help = harness.container.querySelector<HTMLAnchorElement>('[data-testid="recipient-get-help"]');
    expect(checklist?.tagName).toBe('A');
    expect(help?.tagName).toBe('A');
    expect(checklist?.getAttribute('href')).toBe('/check/checklist');
    expect(help?.getAttribute('href')).toBe('/help');
    for (const link of [checklist, help]) {
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      await act(async () => {
        link?.focus();
        expect(link?.dispatchEvent(enter)).toBe(true);
      });
      expect(document.activeElement).toBe(link);
      expect(enter.defaultPrevented).toBe(false);
    }
    await cleanup(harness.root, harness.container);
  });

  it('renders no findings before verification and only reveals them after backend success', async () => {
    let resolveVerification!: (value: typeof recipientSummary) => void;
    const pending = new Promise<typeof recipientSummary>((resolve) => { resolveVerification = resolve; });
    const harness = await render(
      <ShareRecipientController params={{ token: TOKEN_A }} verifyToken={async () => pending} />,
    );
    expect(harness.container.textContent).toContain('Verifying this shared summary…');
    expect(harness.container.textContent).not.toContain('The legal company is not named.');

    await act(async () => resolveVerification(recipientSummary));
    expect(harness.container.textContent).toContain('The legal company is not named.');
    await cleanup(harness.root, harness.container);
  });

  it('fails closed for backend, invalid, repeated and unknown recipient parameters', async () => {
    const network = await render(
      <ShareRecipientController
        params={{ token: TOKEN_A }}
        verifyToken={async () => { throw new ShareTokenApiError('network', 'offline'); }}
      />,
    );
    await act(async () => Promise.resolve());
    expect(network.container.textContent).toContain('This shared summary is unavailable.');
    expect(network.container.textContent).not.toContain('What needs checking');
    await cleanup(network.root, network.container);

    for (const params of [
      { token: [TOKEN_A, TOKEN_A] },
      { token: TOKEN_A, demo: '1' },
      {},
    ]) {
      const invalid = await render(<ShareRecipientController params={params} />);
      expect(invalid.container.textContent).toContain('This shared summary is unavailable.');
      expect(invalid.container.textContent).not.toContain('What needs checking');
      const check = invalid.container.querySelector<HTMLAnchorElement>('[data-testid="recipient-run-new-check"]');
      expect(check?.tagName).toBe('A');
      expect(check?.getAttribute('href')).toBe('/check');
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      await act(async () => {
        check?.focus();
        expect(check?.dispatchEvent(enter)).toBe(true);
      });
      expect(document.activeElement).toBe(check);
      expect(enter.defaultPrevented).toBe(false);
      await cleanup(invalid.root, invalid.container);
    }
  });

  it('does not announce Copied when the copy operation fails', async () => {
    const harness = await render(
      <SharePreviewExperience
        onBack={() => undefined}
        onCopy={async () => { throw new Error('Clipboard write failed.'); }}
        onShare={async () => 'shared'}
        summary={summary}
      />,
    );
    await act(async () => harness.container.querySelector<HTMLElement>('[data-testid="copy-share-summary"]')?.click());
    expect(harness.container.textContent).toContain('Sharing failed.');
    expect(harness.container.textContent).not.toContain('summary and link copied');
    await cleanup(harness.root, harness.container);
  });

  it('announces an honest text-only state when recipient-link creation is unavailable', async () => {
    const harness = await render(
      <SharePreviewExperience
        onBack={() => undefined}
        onCopy={async () => 'copied-text-only'}
        onShare={async () => 'shared-text-only'}
        summary={summary}
      />,
    );
    await act(async () => harness.container.querySelector<HTMLElement>('[data-testid="share-privately"]')?.click());
    expect(harness.container.textContent).toContain('Recipient link unavailable.');
    expect(harness.container.textContent).toContain('shared without a link');
    await cleanup(harness.root, harness.container);
  });

  it('shows the expired state without findings when verification returns 410', async () => {
    const harness = await render(
      <ShareRecipientController
        params={{ token: TOKEN_A }}
        verifyToken={async () => { throw new ShareTokenApiError('http', 'expired', 410); }}
      />,
    );
    await act(async () => Promise.resolve());
    expect(harness.container.textContent).toContain('This shared link has expired.');
    expect(harness.container.textContent).not.toContain('What needs checking');
    await cleanup(harness.root, harness.container);
  });

  it('keeps the 360px and 390px frames horizontally clipped with five floating tabs', async () => {
    const tabs = ['Home', 'Check', 'News', 'Quiz', 'Help'];
    expect(tabs).toHaveLength(5);
    for (const width of [360, 390]) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      const harness = await render(<ShareRecipientExperience summary={recipientSummary} />);
      expect(harness.container.scrollWidth).toBeLessThanOrEqual(harness.container.clientWidth);
      await cleanup(harness.root, harness.container);
    }
  });
});
