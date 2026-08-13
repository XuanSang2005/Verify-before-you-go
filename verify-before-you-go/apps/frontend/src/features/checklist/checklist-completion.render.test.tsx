import { type ReactNode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHECKLIST_ITEM_IDS } from './checklist-items';
import { createEmptyChecklistProgress, setChecklistItemState } from './checklist-model';
import { loadChecklistProgress } from './checklist-storage';
import { ChecklistScreen } from './ChecklistScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('expo-router', () => ({
  Link: function MockLink({ children, href }: { children: ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  },
  router: { replace: vi.fn() },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children, testID }: { children?: ReactNode; testID?: string }) {
    return <div data-testid={testID}>{children}</div>;
  },
}));

vi.mock('@/features/offer-intake/OfferDraftContext', () => ({
  useOfferDraft: () => ({ analysis: undefined }),
}));

vi.mock('./checklist-storage', () => ({
  loadChecklistProgress: vi.fn(),
  retryChecklistReadAndMergeSession: vi.fn(),
  saveChecklistProgressAfterConfirmedRead: vi.fn(async () => undefined),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = { container: HTMLDivElement; root: Root };
const mounted: Harness[] = [];

async function renderChecklist(progress: ReturnType<typeof createEmptyChecklistProgress>) {
  vi.mocked(loadChecklistProgress).mockResolvedValueOnce({ progress, status: 'valid' });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(<ChecklistScreen />);
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

afterEach(async () => {
  while (mounted.length > 0) {
    const harness = mounted.pop();
    if (!harness) continue;
    await act(async () => harness.root.unmount());
    harness.container.remove();
  }
  vi.clearAllMocks();
});

describe('verification checklist completion action', () => {
  it('does not offer the next screen before all five items are reviewed', async () => {
    const container = await renderChecklist(createEmptyChecklistProgress('2026-08-13T01:00:00.000Z'));
    expect(container.querySelector('[data-testid="checklist-continue"]')).toBeNull();
  });

  it('offers a real link to scenario practice after all five items are reviewed', async () => {
    const timestamp = '2026-08-13T01:00:00.000Z';
    const complete = CHECKLIST_ITEM_IDS.reduce(
      (progress, id) => setChecklistItemState(progress, id, 'verified', timestamp),
      createEmptyChecklistProgress(timestamp),
    );
    const container = await renderChecklist(complete);
    const control = container.querySelector<HTMLElement>('[data-testid="checklist-continue"]');

    expect(control?.textContent).toContain('Continue to scenario practice');
    expect(control?.closest('a')?.getAttribute('href')).toBe('/learn/scenario');
    expect(container.textContent).toContain('Reset checklist');
  });
});
