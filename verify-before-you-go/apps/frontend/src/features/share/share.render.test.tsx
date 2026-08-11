import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { SharePreviewExperience } from './SharePreviewScreen';
import { ShareRecipientExperience } from './ShareRecipientScreen';
import { createSafeShareSummary } from './share-model';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-router', () => ({
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

const summary = createSafeShareSummary(undefined, Date.UTC(2026, 7, 11));

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
        onCopy={async () => undefined}
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
        onCopy={async () => undefined}
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
        onCopy={async () => { copies += 1; }}
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

  it('renders the recipient hierarchy once with decorative mascot and working actions', async () => {
    let checklistCalls = 0;
    let helpCalls = 0;
    const harness = await render(
      <ShareRecipientExperience
        onChecklist={() => { checklistCalls += 1; }}
        onHelp={() => { helpCalls += 1; }}
        summary={summary}
      />,
    );
    expect(harness.container.textContent).toContain('Someone you trust shared this offer.');
    expect(harness.container.textContent).toContain('What needs checking');
    expect(harness.container.textContent).toContain('The original screenshot and full identifiers were not shared.');
    expect(harness.container.textContent?.match(/The legal company is not named\./g)).toHaveLength(1);
    const mascot = harness.container.querySelector('[data-testid="share-recipient-mascot"]');
    expect(mascot?.getAttribute('aria-label')).toBeNull();

    await act(async () => harness.container.querySelector<HTMLElement>('[data-testid="recipient-open-checklist"]')?.click());
    await act(async () => harness.container.querySelector<HTMLElement>('[data-testid="recipient-get-help"]')?.click());
    expect(checklistCalls).toBe(1);
    expect(helpCalls).toBe(1);
    await cleanup(harness.root, harness.container);
  });
});
