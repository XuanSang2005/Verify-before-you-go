import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { FloatingTabBar } from '../../../app/(tabs)/_layout';
import type { ReportRecoveryViewRecord } from './report-status-recovery-coordinator';
import { MyReportsExperience, type MyReportsExperienceProps } from './MyReportsScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-router', () => {
  function MockTabs({ children }: { children?: ReactNode }) { return children ?? null; }
  function MockTabsScreen() { return null; }
  return { Tabs: Object.assign(MockTabs, { Screen: MockTabsScreen }) };
});

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const validReportId = 'R-23456789ABCDEFGH';
const validRecoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-ST';

const statuses: ReportRecoveryViewRecord[] = [
  {
    reportId: 'R-23456789ABCDEFGH',
    savedAt: '2026-08-10T08:00:00.000Z',
    lookupState: 'ready',
    submittedAt: '2026-08-10T08:00:00.000Z',
    status: 'received',
    updatedAt: '2026-08-10T08:00:00.000Z',
    nextStep: 'Your report is waiting for an initial privacy review.',
  },
  {
    reportId: 'R-3456789ABCDEFGHJ',
    savedAt: '2026-08-09T08:00:00.000Z',
    lookupState: 'ready',
    submittedAt: '2026-08-09T08:00:00.000Z',
    status: 'under-review',
    updatedAt: '2026-08-11T08:00:00.000Z',
    nextStep: 'The privacy review is complete and evidence review is in progress.',
  },
  {
    reportId: 'R-456789ABCDEFGHJK',
    savedAt: '2026-08-08T08:00:00.000Z',
    lookupState: 'ready',
    submittedAt: '2026-08-08T08:00:00.000Z',
    status: 'more-evidence-needed',
    updatedAt: '2026-08-12T08:00:00.000Z',
    nextStep: 'Use your private report channel to add independently checkable evidence.',
  },
];

function defaultProps(overrides: Partial<MyReportsExperienceProps> = {}): MyReportsExperienceProps {
  return {
    addPending: false,
    clearPending: false,
    isWeb: true,
    loading: false,
    onAdd: vi.fn(async () => true),
    onClear: vi.fn(async () => true),
    onRecoverCorruptVault: vi.fn(async () => true),
    onRefresh: vi.fn(async () => undefined),
    onRetry: vi.fn(async () => undefined),
    records: [],
    storageCorrupt: false,
    ...overrides,
  };
}

function CorruptRecoveryHarness() {
  const [storageCorrupt, setStorageCorrupt] = useState(true);
  return (
    <MyReportsExperience
      {...defaultProps({
        onRecoverCorruptVault: async () => {
          setStorageCorrupt(false);
          return true;
        },
        storageCorrupt,
      })}
    />
  );
}

async function render(node: ReactNode, width = 390) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

function control(container: ParentNode, testID: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!element) throw new Error(`${testID} was not rendered`);
  return element;
}

async function changeText(input: HTMLElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })));
}

describe('CP13 rendered My Reports', () => {
  it('renders Screen 16 hierarchy, web non-persistence copy and clearly labelled synthetic examples', async () => {
    const harness = await render(<MyReportsExperience {...defaultProps()} />);
    expect(harness.container.textContent).toContain('My reports.');
    expect(harness.container.textContent).toContain('This browser session');
    expect(harness.container.textContent).toContain('Refreshing the browser requires the key again.');
    expect(harness.container.textContent).toContain('Synthetic prototype · Example statuses only');
    expect(harness.container.textContent).toContain('R-1042');
    expect(harness.container.textContent).toContain('Customer support · Sihanoukville');
    expect(harness.container.textContent).toContain('Privacy masks checked. Evidence review is next.');
    expect(harness.container.textContent).toContain('Submitted today · Status preview');
    expect(harness.container.textContent).toContain('R-0981');
    expect(harness.container.textContent).toContain('Warehouse packing offer');
    expect(harness.container.textContent).toContain('Add the original domain or a clearer contract page.');
    expect(harness.container.textContent).toContain('Updated 28 Jul · Evidence preview');
    expect(harness.container.textContent).not.toContain('Example report');
    expect(harness.container.textContent).toContain('does not mean verified, published or a scam verdict');
    expect(control(harness.container, 'my-reports-recovery-mascot').getAttribute('aria-label')).toBeNull();
    expect(harness.container.textContent).not.toContain(validRecoveryKey);
    await cleanup(harness.container, harness.root);
  });

  it('renders all three real status treatments without private report material', async () => {
    const harness = await render(<MyReportsExperience {...defaultProps({ records: statuses })} />);
    expect(harness.container.textContent).toContain('Received');
    expect(harness.container.textContent).toContain('Under review');
    expect(harness.container.textContent).toContain('More evidence needed');
    expect(harness.container.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(harness.container.textContent).not.toContain('privateIdentifier');
    expect(harness.container.textContent).not.toContain('ciphertext');
    expect(harness.container.textContent).not.toContain('recovery hash');
    await cleanup(harness.container, harness.root);
  });

  it('validates exact credential formats and clears the raw key from the DOM after add', async () => {
    const onAdd = vi.fn(async () => true);
    const harness = await render(<MyReportsExperience {...defaultProps({ onAdd })} />);
    const reportId = control(harness.container, 'my-reports-report-id');
    const recoveryKey = control(harness.container, 'my-reports-recovery-key');

    await changeText(reportId, 'R-INVALID');
    await changeText(recoveryKey, 'not-a-key');
    await act(async () => control(harness.container, 'my-reports-add-key').click());
    expect(onAdd).not.toHaveBeenCalled();
    expect(harness.container.textContent).toContain('exactly as shown');

    await changeText(reportId, validReportId);
    await changeText(recoveryKey, validRecoveryKey);
    await act(async () => {
      control(harness.container, 'my-reports-add-key').click();
      await Promise.resolve();
    });
    expect(onAdd).toHaveBeenCalledWith(validReportId, validRecoveryKey);
    expect((recoveryKey as HTMLInputElement).value).toBe('');
    expect(harness.container.textContent).not.toContain(validRecoveryKey);
    await cleanup(harness.container, harness.root);
  });

  it('requires keyboard-operable confirmation, explains server retention and returns focus on cancel', async () => {
    const onClear = vi.fn(async () => true);
    const harness = await render(<MyReportsExperience {...defaultProps({ onClear, records: statuses })} />);
    const trigger = control(harness.container, 'my-reports-clear-keys');
    await act(async () => trigger.click());
    const dialog = control(document, 'my-reports-clear-dialog');
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.textContent).toContain('does not delete reports from the server');

    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.querySelector('[data-testid="my-reports-clear-dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    await act(async () => {
      control(document, 'my-reports-clear-confirm').click();
      await Promise.resolve();
    });
    expect(onClear).toHaveBeenCalledTimes(1);
    await cleanup(harness.container, harness.root);
  });

  it.each([360, 390, 768, 1024])('keeps the page clipped and controls at least 48px at %ipx', async (width) => {
    const harness = await render(<MyReportsExperience {...defaultProps({ records: statuses })} />, width);
    const screen = harness.container.firstElementChild as HTMLElement | null;
    expect(screen).toBeTruthy();
    if (!screen) throw new Error('My Reports page frame was not rendered');
    expect(window.getComputedStyle(screen).maxWidth).toBe('100%');
    for (const testID of ['my-reports-add-key', 'my-reports-clear-keys', `my-report-refresh-${statuses[0]?.reportId}`]) {
      expect(Number.parseFloat(window.getComputedStyle(control(harness.container, testID)).minHeight)).toBeGreaterThanOrEqual(48);
    }
    await cleanup(harness.container, harness.root);
  });

  it('renders loading, offline, unavailable, invalid and corrupt-vault recovery states', async () => {
    for (const props of [
      defaultProps({ loading: true }),
      defaultProps({ notice: { kind: 'offline', message: 'Connect to retry.' } }),
      defaultProps({ notice: { kind: 'unavailable', message: 'Try later.' } }),
      defaultProps({ notice: { kind: 'invalid', message: 'Check both values.' } }),
      defaultProps({ storageCorrupt: true }),
    ]) {
      const harness = await render(<MyReportsExperience {...props} />);
      expect(harness.container.querySelector('[role="heading"]')).toBeTruthy();
      await cleanup(harness.container, harness.root);
    }
  });

  it('never shows synthetic status examples alongside an API or credential failure', async () => {
    for (const notice of [
      { kind: 'invalid' as const, message: 'Check both values.' },
      { kind: 'offline' as const, message: 'Connect to retry.' },
      { kind: 'unavailable' as const, message: 'Try later.' },
    ]) {
      const harness = await render(<MyReportsExperience {...defaultProps({ notice })} />);
      expect(harness.container.textContent).not.toContain('Synthetic prototype');
      expect(harness.container.textContent).not.toContain('Example report');
      await cleanup(harness.container, harness.root);
    }
  });

  it('traps keyboard focus in confirmation and restores it to the correct control', async () => {
    const harness = await render(<MyReportsExperience {...defaultProps({ records: statuses })} />);
    const trigger = control(harness.container, 'my-reports-clear-keys');
    await act(async () => trigger.click());
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const cancel = control(document, 'my-reports-clear-cancel');
    const confirm = control(document, 'my-reports-clear-confirm');
    expect(document.activeElement).toBe(cancel);

    await act(async () => {
      confirm.focus();
      confirm.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' }));
    });
    expect(document.activeElement).toBe(cancel);
    await act(async () => {
      cancel.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Tab',
        shiftKey: true,
      }));
    });
    expect(document.activeElement).toBe(confirm);

    await act(async () => cancel.click());
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(trigger);
    await cleanup(harness.container, harness.root);
  });

  it('returns focus to recovery entry after a successful clear or corrupt-vault reset', async () => {
    for (const scenario of ['clear', 'corrupt'] as const) {
      const harness = await render(scenario === 'clear'
        ? <MyReportsExperience {...defaultProps({ records: statuses })} />
        : <CorruptRecoveryHarness />);
      const trigger = scenario === 'corrupt'
        ? control(harness.container, 'my-reports-recover-corrupt')
        : control(harness.container, 'my-reports-clear-keys');
      await act(async () => trigger.click());
      await act(async () => {
        control(document, 'my-reports-clear-confirm').click();
        await Promise.resolve();
      });
      await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      expect(document.activeElement?.id).toBe('my-reports-report-id-field');
      await cleanup(harness.container, harness.root);
    }
  });

  it('keeps saved access visible offline and exposes a keyboard-operable retry', async () => {
    const onRetry = vi.fn(async () => undefined);
    const offlineRecord: ReportRecoveryViewRecord = {
      reportId: validReportId,
      savedAt: '2026-08-12T08:00:00.000Z',
      lookupState: 'offline',
      message: 'Offline. Connect to refresh this report status.',
    };
    const harness = await render(<MyReportsExperience {...defaultProps({
      notice: { kind: 'offline', message: offlineRecord.message ?? '' },
      onRetry,
      records: [offlineRecord],
    })} />);

    expect(control(harness.container, `my-report-${validReportId}`).textContent).toContain('Offline');
    expect(harness.container.querySelector('[data-testid="my-reports-empty"]')).toBeNull();
    const retry = control(harness.container, 'my-reports-retry');
    expect(retry.getAttribute('role')).toBe('button');
    expect(retry.tabIndex).toBe(0);
    await act(async () => {
      retry.focus();
      retry.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      retry.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
      await Promise.resolve();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    await cleanup(harness.container, harness.root);
  });
});

function createTabBarProps() {
  const routes = [
    { key: 'home-key', name: 'index', params: undefined },
    { key: 'check-key', name: 'check', params: undefined },
    { key: 'news-key', name: 'news', params: undefined },
    { key: 'quiz-key', name: 'quiz', params: undefined },
    { key: 'help-key', name: 'help', params: undefined },
    { key: 'reports-key', name: 'reports', params: undefined },
  ];
  return {
    descriptors: Object.fromEntries(routes.map((route) => [route.key, {
      options: { tabBarAccessibilityLabel: route.name === 'index' ? 'Home' : `${route.name[0]?.toUpperCase()}${route.name.slice(1)}` },
    }])),
    navigation: { emit: vi.fn(() => ({ defaultPrevented: false })), navigate: vi.fn() },
    state: {
      history: [],
      index: 5,
      key: 'tabs-key',
      routeNames: routes.map((route) => route.name),
      routes,
      stale: false,
      type: 'tab',
    },
  };
}

describe.each([360, 390])('CP13 floating navigation at %ipx', (width) => {
  it('keeps exactly the approved five tabs and never creates Reports as a sixth tab', async () => {
    const props = createTabBarProps() as unknown as Parameters<typeof FloatingTabBar>[0];
    const harness = await render(<FloatingTabBar {...props} />, width);
    const tabs = [...harness.container.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Home', 'Check', 'News', 'Quiz', 'Help']);
    expect(harness.container.querySelector('[data-testid="floating-tab-reports"]')).toBeNull();
    await cleanup(harness.container, harness.root);
  });
});
