import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StartupOnboardingGate } from './StartupOnboardingGate';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({
    accessibilityViewIsModal: _accessibilityViewIsModal,
    children,
    edges: _edges,
    testID,
    ...props
  }: {
    accessibilityViewIsModal?: boolean;
    children?: ReactNode;
    edges?: string[];
    testID?: string;
  }) {
    return <div data-testid={testID} {...props}>{children}</div>;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StartupOnboardingGate', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <StartupOnboardingGate>
          <button type="button">Underlying app action</button>
        </StartupOnboardingGate>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function button(label: string) {
    return [...container.querySelectorAll<HTMLElement>('[role="button"],button')]
      .find((element) => element.getAttribute('aria-label') === label || element.textContent === label);
  }

  async function click(element: Element | undefined) {
    expect(element).toBeTruthy();
    await act(async () => element?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  }

  it('opens on Card 01 on every fresh mount and hides the underlying app from accessibility', () => {
    expect(container.textContent).toContain('Card 01 / 03');
    expect(container.textContent).toContain('Paste the offer. See how it was built.');
    expect(container.querySelector('[data-testid="startup-onboarding"]')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('Underlying app action');
    expect(document.activeElement?.textContent).toContain('Paste the offer');
    expect(container.textContent).not.toContain('Findings are counted');
  });

  it('moves through all three cards and starts on the route already mounted underneath', async () => {
    await click(button('Next onboarding card, 2 of 3'));
    expect(container.textContent).toContain('It will not decide for you.');
    expect(container.textContent).not.toContain('The job might be real');
    await click(button('Next onboarding card, 3 of 3'));
    expect(container.textContent).toContain('Help works without an account.');
    expect(container.textContent).toContain('Save them before you travel.');
    expect(container.textContent).not.toContain('No account, no email');
    await click(button('Start using Verify Before You Go'));
    expect(container.querySelector('[data-testid="startup-onboarding"]')).toBeNull();
    expect(container.textContent).toContain('Underlying app action');
  });

  it('Skip dismisses the startup layer without writing an already-seen flag', async () => {
    await click(button('Skip onboarding and open the app'));
    expect(container.querySelector('[data-testid="startup-onboarding"]')).toBeNull();
    expect(container.textContent).toContain('Underlying app action');
  });
});
