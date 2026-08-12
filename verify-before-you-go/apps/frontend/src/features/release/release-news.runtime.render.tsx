import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { NewsroomScreen } from '@/features/news/NewsroomScreen';

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

async function waitForReady(container: HTMLElement) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (container.querySelector('[data-testid="news-card-seasonal-work-six-fields-to-verify"]')) return;
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 25)); });
  }
  throw new Error('The rendered newsroom did not reach its ready state.');
}

it('CP16 rendered newsroom leaves loading and displays real backend stories', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<NewsroomScreen />));
  await waitForReady(container);

  expect(container.textContent).not.toContain('Loading the newsroom');
  expect(container.textContent).toContain('Seasonal work: six fields to verify');
  expect(container.querySelectorAll('[data-testid^="news-card-"]').length).toBeGreaterThan(0);

  await act(async () => root.unmount());
  container.remove();
});
