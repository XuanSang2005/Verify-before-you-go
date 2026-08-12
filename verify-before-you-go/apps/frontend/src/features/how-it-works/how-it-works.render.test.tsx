import userEvent from '@testing-library/user-event';
import { act, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { HowItWorksScreen } from './HowItWorksScreen';

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

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
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
    root.render(<HowItWorksScreen illustrationSource={{ uri: 'screen-01-illustration.jpg' }} />);
  });
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

describe.each([360, 390, 768, 1024])('CP15 How It Works at %ipx', (width) => {
  it('keeps the headerless Screen 01 hierarchy without overflow or an onboarding gate', async () => {
    const harness = await renderAtWidth(width);
    expect(harness.container.querySelector('[role="heading"]')?.textContent).toBe('How it works');
    expect(harness.container.querySelector('[data-testid="how-it-works-screen01-illustration"] img')).not.toBeNull();
    expect(harness.container.querySelectorAll('[data-testid^="how-it-works-step-"]')).toHaveLength(3);
    expect(harness.container.textContent).toContain('No scam score. No verdict.');
    expect(harness.container.textContent).toContain('Know what stays where');
    expect(harness.container.textContent).toContain('Independent verification is the next step');
    expect(harness.container.textContent).not.toContain('Verify Before You Go');
    const exactControlLabels = Array.from(
      harness.container.querySelectorAll<HTMLElement>('[role="button"], [role="link"]'),
      (control) => control.textContent?.trim(),
    );
    expect(exactControlLabels).not.toContain('Skip');
    expect(exactControlLabels).not.toContain('Start');
    expect(harness.container.scrollWidth).toBeLessThanOrEqual(harness.container.clientWidth || width);
    await cleanup(harness.container, harness.root);
  });
});

it('renders genuine Home, Check and Help links with 48px targets and keyboard activation', async () => {
  const harness = await renderAtWidth(390);
  const keyboard = userEvent.setup();

  for (const destination of ['/', '/check', '/help']) {
    const link = harness.container.querySelector<HTMLAnchorElement>(`a[href="${destination}"]`);
    expect(link).not.toBeNull();
    expect(Number.parseFloat(window.getComputedStyle(link!).minHeight)).toBeGreaterThanOrEqual(48);
    let activated = false;
    link!.addEventListener('click', (event) => {
      activated = true;
      event.preventDefault();
    }, { once: true });
    await act(async () => {
      link!.focus();
      await keyboard.keyboard('{Enter}');
    });
    expect(activated).toBe(true);
  }

  await cleanup(harness.container, harness.root);
});

it('keeps the exact Screen 01 illustration decorative and reads privacy copy once', async () => {
  const harness = await renderAtWidth(390);
  const image = harness.container.querySelector<HTMLImageElement>('[data-testid="how-it-works-screen01-illustration"] img');
  expect(image?.getAttribute('aria-label')).toBeNull();
  expect(image?.getAttribute('alt') ?? '').toBe('');

  const text = harness.container.textContent ?? '';
  expect(text.match(/The selected checker screenshot is not uploaded or read\./gu)).toHaveLength(1);
  expect(text.match(/Nothing is published automatically\./gu)).toHaveLength(1);
  await cleanup(harness.container, harness.root);
});
