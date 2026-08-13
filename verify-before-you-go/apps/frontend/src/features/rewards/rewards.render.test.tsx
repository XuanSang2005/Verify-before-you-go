import {
  act,
  cloneElement,
  isValidElement,
  useEffect,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import type { ReportSubmissionResponse } from '@vbyg/contracts';

import { FloatingTabBar } from '../../../app/(tabs)/_layout';
import { MIL_QUIZ_QUESTIONS } from '../quiz/quiz-content';
import { QuizScreenController } from '../quiz/QuizScreen';
import {
  advanceQuiz,
  answerQuizQuestion,
  createEmptyQuizProgress,
  type QuizProgress,
} from '../quiz/quiz-model';
import type { QuizPersistenceCoordinatorPort } from '../quiz/quiz-persistence-coordinator';
import {
  createEmptyReportDraft,
  toggleReportBehaviour,
  updateReportDraft,
} from '../reports/report-model';
import { ReportReceiptExperience, ReportReceiptScreen } from '../reports/ReportReceiptScreen';
import { ReportSubmissionProvider, useReportSubmission } from '../reports/ReportSubmissionContext';
import type { ReportSubmissionCoordinator } from '../reports/report-submission-coordinator';
import { RewardProvider, useReward } from './RewardContext';
import {
  getVoucherActionClearance,
  RewardVoucherExperience,
  RewardVoucherScreen,
} from './RewardVoucherScreen';
import type { ClipboardWriter } from './reward-model';

vi.mock('expo-router', () => {
  function Link({ asChild, children, href }: { asChild?: boolean; children: ReactNode; href: string }) {
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, { href });
    }
    return <a href={href}>{children}</a>;
  }
  function MockTabs({ children }: { children?: ReactNode }) { return children ?? null; }
  const Tabs = Object.assign(MockTabs, { Screen: function MockTabsScreen() { return null; } });
  return {
    Link,
    Tabs,
    router: { push: vi.fn(), replace: vi.fn() },
    useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children, testID }: { children?: ReactNode; testID?: string }) {
    return <div data-testid={testID}>{children}</div>;
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = { container: HTMLDivElement; root: Root };

async function renderAtWidth(node: ReactNode, width = 390): Promise<Harness> {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

async function cleanup(harness: Harness) {
  await act(async () => harness.root.unmount());
  harness.container.remove();
}

async function flushAnimationFrames(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
}

function control(container: HTMLElement, testID: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!element) throw new Error(`${testID} was not rendered`);
  return element;
}

function quizAwaitingCompletion(correctAnswers: number): QuizProgress {
  let progress = createEmptyQuizProgress('2026-08-13T01:00:00.000Z');
  MIL_QUIZ_QUESTIONS.forEach((question, index) => {
    const wrong = question.options.find(({ id }) => id !== question.correctOptionId)?.id;
    progress = answerQuizQuestion(
      progress,
      index < correctAnswers ? question.correctOptionId : wrong ?? question.correctOptionId,
      `2026-08-13T01:0${index}:00.000Z`,
    );
    if (index < MIL_QUIZ_QUESTIONS.length - 1) {
      progress = advanceQuiz(progress, `2026-08-13T01:0${index}:30.000Z`);
    }
  });
  return progress;
}

function quizPersistence(progress: QuizProgress): QuizPersistenceCoordinatorPort {
  return {
    enqueue: async () => ({ isLatest: true, revision: 1, status: 'saved' }),
    hydrate: async () => ({ progress, status: 'valid' }),
    subscribe: () => () => undefined,
    whenIdle: async () => undefined,
  };
}

function QuizRewardHarness({ correctAnswers }: { correctAnswers: number }) {
  return (
    <RewardProvider>
      <QuizScreenController
        mascotSource={{ uri: 'quiz-insight-v3.png' }}
        onOpenChecker={() => undefined}
        persistence={quizPersistence(quizAwaitingCompletion(correctAnswers))}
      />
    </RewardProvider>
  );
}

const receipt: ReportSubmissionResponse = {
  report: {
    reportId: 'R-23456789ABCDEFGH',
    submittedAt: '2026-08-13T02:00:00.000Z',
    status: 'received',
    statusLabel: 'Received — not yet reviewed.',
    privateIntakeNotice: 'This private receipt does not mean the report has been reviewed, verified or published.',
  },
  recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
  recoveryKeyStatus: 'delivered',
};

const validDraft = updateReportDraft(
  toggleReportBehaviour(createEmptyReportDraft('2026-08-13T01:00:00.000Z'), 'pressure'),
  {
    description: 'The sender pressed for an immediate response.',
    identifier: '@private_sender',
    identifierType: 'handle',
  },
  '2026-08-13T01:01:00.000Z',
);

function ReportRewardProbe() {
  const submission = useReportSubmission();
  const reward = useReward();
  return (
    <div>
      <button data-testid="submit-report" onClick={() => void submission.submitDraft(validDraft)}>Submit</button>
      <span data-testid="submission-pending">{String(submission.submissionPending)}</span>
      <span data-testid="reward-source">{reward.eligibility ?? 'none'}</span>
    </div>
  );
}

function ReportReceiptScreenIntegrationProbe({
  onSubmitStarted,
}: {
  onSubmitStarted?: (submission: Promise<boolean>) => void;
}) {
  const submission = useReportSubmission();
  const reward = useReward();
  return (
    <div>
      <button
        data-testid="submit-report"
        onClick={() => {
          const pendingSubmission = submission.submitDraft(validDraft);
          onSubmitStarted?.(pendingSubmission);
          void pendingSubmission;
        }}
      >Submit</button>
      <span data-testid="submission-pending">{String(submission.submissionPending)}</span>
      <span data-testid="submission-error">{submission.submissionError ?? ''}</span>
      <span data-testid="reward-source">{reward.eligibility ?? 'none'}</span>
      <button data-testid="clear-report-flow" onClick={() => void submission.clearForNewReport()}>Clear</button>
      <ReportReceiptScreen />
    </div>
  );
}

function ReportRewardHarness({ coordinator }: { coordinator: ReportSubmissionCoordinator }) {
  return (
    <RewardProvider>
      <ReportSubmissionProvider coordinator={coordinator}>
        <ReportRewardProbe />
      </ReportSubmissionProvider>
    </RewardProvider>
  );
}

function ReportRewardReceiptHarness({
  coordinator,
  onSubmitStarted,
}: {
  coordinator: ReportSubmissionCoordinator;
  onSubmitStarted?: (submission: Promise<boolean>) => void;
}) {
  return (
    <RewardProvider>
      <ReportSubmissionProvider coordinator={coordinator}>
        <ReportReceiptScreenIntegrationProbe onSubmitStarted={onSubmitStarted} />
      </ReportSubmissionProvider>
    </RewardProvider>
  );
}

function fakeReportCoordinator(submit: () => Promise<ReportSubmissionResponse>) {
  return {
    clearAttempt: async () => undefined,
    submit: async () => ({
      response: await submit(),
      retention: { message: 'Saved for this test.', status: 'saved-securely' as const },
    }),
  } as unknown as ReportSubmissionCoordinator;
}

describe('CP17 qualifying flow entry points', () => {
  it('unlocks only a perfect 5/5 quiz and Retry removes that eligibility', async () => {
    const harness = await renderAtWidth(<QuizRewardHarness correctAnswers={5} />);
    await act(async () => control(harness.container, 'quiz-next').click());
    expect(harness.container.textContent).toContain('Perfect score — voucher unlocked');
    expect(control(harness.container, 'view-voucher').getAttribute('href')).toBe('/rewards/voucher');

    await act(async () => control(harness.container, 'quiz-retry').click());
    expect(harness.container.querySelector('[data-testid="reward-unlocked-card"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="quiz-question"]')).not.toBeNull();

    for (const question of MIL_QUIZ_QUESTIONS) {
      await act(async () => control(harness.container, `quiz-option-${question.correctOptionId}`).click());
      await act(async () => control(harness.container, 'quiz-next').click());
    }
    expect(harness.container.textContent).toContain('Perfect score — voucher unlocked');
    await cleanup(harness);
  });

  it('keeps a 4/5 quiz locked with gentle retry copy', async () => {
    const harness = await renderAtWidth(<QuizRewardHarness correctAnswers={4} />);
    await act(async () => control(harness.container, 'quiz-next').click());
    expect(harness.container.querySelector('[data-testid="reward-unlocked-card"]')).toBeNull();
    expect(control(harness.container, 'quiz-reward-locked').textContent).toContain('Try again whenever you want');
    await cleanup(harness);
  });

  it('unlocks only after report API success, never while pending or after failure', async () => {
    let resolveReport!: (value: ReportSubmissionResponse) => void;
    const pendingResponse = new Promise<ReportSubmissionResponse>((resolve) => { resolveReport = resolve; });
    const pendingHarness = await renderAtWidth(
      <ReportRewardHarness coordinator={fakeReportCoordinator(() => pendingResponse)} />,
    );
    await act(async () => {
      control(pendingHarness.container, 'submit-report').click();
      await Promise.resolve();
    });
    expect(control(pendingHarness.container, 'submission-pending').textContent).toBe('true');
    expect(control(pendingHarness.container, 'reward-source').textContent).toBe('none');
    await act(async () => {
      resolveReport(receipt);
      await pendingResponse;
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(control(pendingHarness.container, 'reward-source').textContent).toBe('private-report-submitted');
    await cleanup(pendingHarness);

    const failedHarness = await renderAtWidth(
      <ReportRewardHarness coordinator={fakeReportCoordinator(async () => { throw new Error('network failed'); })} />,
    );
    await act(async () => {
      control(failedHarness.container, 'submit-report').click();
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(control(failedHarness.container, 'reward-source').textContent).toBe('none');
    await cleanup(failedHarness);
  });

  it('shows the report reward entry only on a real receipt with current-session eligibility', async () => {
    const unlocked = await renderAtWidth(
      <ReportReceiptExperience
        onViewStatus={() => undefined}
        receipt={receipt}
        rewardUnlocked
      />,
    );
    expect(unlocked.container.textContent).toContain('Thank you for contributing — voucher unlocked');
    expect(unlocked.container.textContent).toContain('Received — not yet reviewed.');
    expect(control(unlocked.container, 'view-voucher').getAttribute('href')).toBe('/rewards/voucher');
    const recoveryPanel = control(unlocked.container, 'report-recovery-panel');
    const copyRecovery = control(unlocked.container, 'report-copy-recovery-key');
    const downloadRecovery = control(unlocked.container, 'report-download-recovery-key');
    const rewardCard = control(unlocked.container, 'reward-unlocked-card');
    for (const recoveryControl of [recoveryPanel, copyRecovery, downloadRecovery]) {
      expect(recoveryControl.compareDocumentPosition(rewardCard) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    expect(rewardCard.textContent).not.toContain(receipt.report.reportId);
    expect(rewardCard.textContent).not.toContain(receipt.recoveryKey);
    await cleanup(unlocked);

    const locked = await renderAtWidth(
      <ReportReceiptExperience onViewStatus={() => undefined} receipt={receipt} />,
    );
    expect(locked.container.querySelector('[data-testid="reward-unlocked-card"]')).toBeNull();
    await cleanup(locked);
  });

  it('renders the production ReportReceiptScreen across pending, failure, success, recovery error and clear', async () => {
    let resolveReport!: (value: ReportSubmissionResponse) => void;
    const pendingResponse = new Promise<ReportSubmissionResponse>((resolve) => { resolveReport = resolve; });
    let clearCalls = 0;
    const pendingCoordinator = fakeReportCoordinator(() => pendingResponse);
    pendingCoordinator.clearAttempt = async () => { clearCalls += 1; };
    let submissionPromise: Promise<boolean> | undefined;
    const harness = await renderAtWidth(
      <ReportRewardReceiptHarness
        coordinator={pendingCoordinator}
        onSubmitStarted={(submission) => { submissionPromise = submission; }}
      />,
    );
    await act(async () => {
      control(harness.container, 'submit-report').click();
      await Promise.resolve();
    });
    expect(control(harness.container, 'submission-pending').textContent).toBe('true');
    expect(control(harness.container, 'report-receipt-missing')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="reward-unlocked-card"]')).toBeNull();

    let submissionResult: boolean | undefined;
    await act(async () => {
      resolveReport(receipt);
      submissionResult = await submissionPromise;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(submissionResult).toBe(true);
    const rewardCard = control(harness.container, 'reward-unlocked-card');
    expect(control(harness.container, 'report-receipt-screen')).toBeTruthy();
    expect(rewardCard.textContent).toContain('Thank you for contributing — voucher unlocked');
    expect(rewardCard.textContent).not.toContain(receipt.report.reportId);
    expect(rewardCard.textContent).not.toContain(receipt.recoveryKey);
    const copyControl = control(harness.container, 'report-copy-recovery-key');
    const downloadControl = control(harness.container, 'report-download-recovery-key');
    for (const recoveryControl of [copyControl, downloadControl]) {
      expect(recoveryControl.compareDocumentPosition(rewardCard) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }

    const clipboard = vi.mocked((await import('expo-clipboard')).setStringAsync);
    clipboard.mockRejectedValueOnce(new Error('clipboard rejected'));
    await act(async () => copyControl.click());
    const copyError = control(harness.container, 'report-copy-recovery-error');
    const viewStatus = control(harness.container, 'report-view-status');
    expect(copyError.getAttribute('aria-live')).toBe('assertive');
    expect(copyError.textContent).not.toContain(receipt.recoveryKey);
    for (const earlier of [copyControl, downloadControl]) {
      expect(earlier.compareDocumentPosition(copyError) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    for (const later of [rewardCard, viewStatus]) {
      expect(copyError.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }

    await act(async () => {
      control(harness.container, 'clear-report-flow').click();
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(clearCalls).toBe(1);
    expect(harness.container.querySelector('[data-testid="report-receipt-screen"]')).toBeNull();
    expect(control(harness.container, 'report-receipt-missing')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="reward-unlocked-card"]')).toBeNull();
    expect(control(harness.container, 'reward-source').textContent).toBe('none');
    await cleanup(harness);

    const failed = await renderAtWidth(
      <ReportRewardReceiptHarness coordinator={fakeReportCoordinator(async () => { throw new Error('service unavailable'); })} />,
    );
    await act(async () => {
      control(failed.container, 'submit-report').click();
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(control(failed.container, 'submission-error').textContent).toContain('service unavailable');
    expect(failed.container.querySelector('[data-testid="report-receipt-screen"]')).toBeNull();
    expect(control(failed.container, 'report-receipt-missing')).toBeTruthy();
    expect(failed.container.querySelector('[data-testid="reward-unlocked-card"]')).toBeNull();
    await cleanup(failed);
  });

  it('prioritizes assertive copy-failure guidance after recovery controls and before reward and status', async () => {
    const copy = vi.mocked((await import('expo-clipboard')).setStringAsync);
    copy.mockRejectedValueOnce(new Error('clipboard rejected'));
    const harness = await renderAtWidth(
      <ReportReceiptExperience
        onViewStatus={() => undefined}
        receipt={receipt}
        rewardUnlocked
      />,
    );
    await act(async () => control(harness.container, 'report-copy-recovery-key').click());
    const copyControl = control(harness.container, 'report-copy-recovery-key');
    const downloadControl = control(harness.container, 'report-download-recovery-key');
    const error = control(harness.container, 'report-copy-recovery-error');
    const rewardCard = control(harness.container, 'reward-unlocked-card');
    const status = control(harness.container, 'report-view-status');
    for (const earlier of [copyControl, downloadControl]) {
      expect(earlier.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    for (const later of [rewardCard, status]) {
      expect(error.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
    expect(error.getAttribute('aria-live')).toBe('assertive');
    expect(error.textContent).not.toContain(receipt.recoveryKey);
    await cleanup(harness);

    copy.mockResolvedValueOnce(true);
    const successful = await renderAtWidth(
      <ReportReceiptExperience onViewStatus={() => undefined} receipt={receipt} rewardUnlocked />,
    );
    await act(async () => control(successful.container, 'report-copy-recovery-key').click());
    expect(successful.container.querySelector('[data-testid="report-copy-recovery-error"]')).toBeNull();
    await cleanup(successful);
  });
});

describe.each([360, 390, 768, 1024])('CP17 voucher at %ipx', (width) => {
  it('renders each source with its safe code and no private report material or overflow', async () => {
    for (const [source, code] of [
      ['quiz-perfect', 'VBYG-DEMO-5OF5'],
      ['private-report-submitted', 'VBYG-DEMO-REPORT'],
    ] as const) {
      const harness = await renderAtWidth(<RewardVoucherExperience eligibility={source} />, width);
      expect(control(harness.container, 'voucher-code').textContent).toBe(code);
      expect(harness.container.textContent).toContain('Synthetic prototype — not redeemable');
      expect(harness.container.textContent).toContain('no monetary value');
      expect(harness.container.textContent).not.toContain(receipt.report.reportId);
      expect(harness.container.textContent).not.toContain(receipt.recoveryKey);
      expect(window.location.search).toBe('');
      expect(harness.container.scrollWidth).toBeLessThanOrEqual(harness.container.clientWidth || width);
      for (const testID of ['copy-voucher-code', 'voucher-done', 'voucher-how-rewards-work']) {
        expect(Number.parseFloat(window.getComputedStyle(control(harness.container, testID)).minHeight)).toBeGreaterThanOrEqual(48);
      }
      await cleanup(harness);
    }
  });
});

it('defers an action block that would enter the floating-dock clearance, without shifting a clear block', () => {
  expect(getVoucherActionClearance({
    actionBlockHeight: 154,
    actionRegionTop: 650,
    viewportHeight: 800,
  })).toBe(158);
  expect(getVoucherActionClearance({
    actionBlockHeight: 154,
    actionRegionTop: 520,
    viewportHeight: 800,
  })).toBe(0);
});

it('fails closed on direct refresh and exposes genuine Quiz and Report links', async () => {
  const harness = await renderAtWidth(<RewardProvider><RewardVoucherScreen /></RewardProvider>);
  expect(harness.container.textContent).toContain('Voucher not available in this session');
  expect(harness.container.querySelector('[data-testid="voucher-code"]')).toBeNull();
  expect(control(harness.container, 'voucher-go-quiz').getAttribute('href')).toBe('/quiz');
  expect(control(harness.container, 'voucher-go-report').getAttribute('href')).toBe('/reports/new');
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(document.activeElement?.id).toBe('voucher-screen-heading');
  expect(window.getComputedStyle(document.activeElement!).outlineStyle).toBe('solid');
  await cleanup(harness);
});

it.each(['quiz-perfect', 'private-report-submitted'] as const)(
  'does not focus the hidden Voucher scene when %s eligibility changes, then focuses it after route activation',
  async (eligibility) => {
    window.history.replaceState({}, '', '/quiz');
    const harness = await renderAtWidth(
      <div>
        <button data-testid="quiz-visible-focus" id="quiz-visible-focus">Quiz action</button>
        <div aria-hidden="true">
          <RewardVoucherExperience routeActive={false} />
        </div>
      </div>,
    );
    const quizFocus = control(harness.container, 'quiz-visible-focus');
    quizFocus.focus();
    await act(async () => {
      harness.root.render(
        <div>
          <button data-testid="quiz-visible-focus" id="quiz-visible-focus">Quiz action</button>
          <div aria-hidden="true">
            <RewardVoucherExperience eligibility={eligibility} routeActive={false} />
          </div>
        </div>,
      );
    });
    await flushAnimationFrames();
    expect(window.location.pathname).toBe('/quiz');
    expect(document.activeElement?.id).toBe('quiz-visible-focus');
    expect(document.activeElement?.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.activeElement?.id).not.toBe('voucher-screen-heading');

    window.history.replaceState({}, '', '/rewards/voucher');
    await act(async () => {
      harness.root.render(
        <div>
          <div aria-hidden="true"><button data-testid="quiz-visible-focus" id="quiz-visible-focus">Quiz action</button></div>
          <RewardVoucherExperience eligibility={eligibility} routeActive />
        </div>,
      );
    });
    await flushAnimationFrames();
    expect(window.location.pathname).toBe('/rewards/voucher');
    expect(document.activeElement?.id).toBe('voucher-screen-heading');
    expect(document.activeElement?.textContent).toBe('Your voucher is ready.');
    expect(document.activeElement?.closest('[aria-hidden="true"]')).toBeNull();
    await cleanup(harness);
    window.history.replaceState({}, '', '/');
  },
);

const clipboardCases: readonly [string, ClipboardWriter, string][] = [
  ['true', async (): Promise<boolean> => true, 'Demo code copied'],
  ['void', async (): Promise<void> => undefined, 'Demo code copied'],
  ['false', async (): Promise<boolean> => false, 'Copy failed'],
  ['rejection', async (): Promise<void> => { throw new Error('denied'); }, 'Copy failed'],
];

it.each(clipboardCases)('reports clipboard %s honestly in a live region', async (_label, copy, expected) => {
  const harness = await renderAtWidth(<RewardVoucherExperience copy={copy} eligibility="quiz-perfect" />);
  await act(async () => control(harness.container, 'copy-voucher-code').click());
  const status = control(harness.container, 'voucher-copy-status');
  expect(status.textContent).toContain(expected);
  expect(status.getAttribute('aria-live')).toBe(expected === 'Demo code copied' ? 'polite' : 'assertive');
  await cleanup(harness);
});

it('renders genuine links with meaningful destinations plus native and Space activation', async () => {
  const harness = await renderAtWidth(<RewardVoucherExperience eligibility="quiz-perfect" />);
  expect(control(harness.container, 'voucher-how-rewards-work').textContent).toBe('How this app works');
  expect(control(harness.container, 'voucher-how-rewards-work').getAttribute('href')).toBe('/how-it-works');
  for (const testID of ['voucher-done', 'voucher-how-rewards-work']) {
    const link = control(harness.container, testID) as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    let activations = 0;
    link.addEventListener('click', (event) => {
      activations += 1;
      event.preventDefault();
    });
    await act(async () => link.click());
    expect(activations).toBe(1);
    await act(async () => link.focus());
    await act(async () => {
      link.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    });
    expect(activations).toBe(2);
  }
  await cleanup(harness);
});

it('keeps the voucher route inside exactly five floating tabs without a Rewards tab', async () => {
  const routes = [
    { key: 'home-key', name: 'index', params: undefined },
    { key: 'check-key', name: 'check', params: undefined },
    { key: 'news-key', name: 'news', params: undefined },
    { key: 'quiz-key', name: 'quiz', params: undefined },
    { key: 'help-key', name: 'help', params: undefined },
    { key: 'reward-key', name: 'rewards', params: undefined },
  ];
  const navigation = { emit: vi.fn(() => ({ defaultPrevented: false })), navigate: vi.fn() };
  const harness = await renderAtWidth(
    <FloatingTabBar {...({
      descriptors: Object.fromEntries(routes.map((route) => [route.key, { options: { tabBarAccessibilityLabel: route.name } }])),
      navigation,
      state: { history: [], index: 5, key: 'tabs', routeNames: routes.map(({ name }) => name), routes, stale: false, type: 'tab' },
    } as unknown as Parameters<typeof FloatingTabBar>[0])} />,
  );
  const tabs = [...harness.container.querySelectorAll<HTMLElement>('[role="tab"]')];
  expect(tabs).toHaveLength(5);
  expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  const home = control(harness.container, 'floating-tab-index') as HTMLAnchorElement;
  expect(home.getAttribute('aria-selected')).toBe('true');
  expect(home.getAttribute('href')).toBe('/');
  expect(harness.container.querySelector('[data-testid="floating-tab-rewards"]')).toBeNull();
  const ordinaryClick = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true });
  await act(async () => home.dispatchEvent(ordinaryClick));
  expect(ordinaryClick.defaultPrevented).toBe(true);
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('index', undefined);
  await cleanup(harness);
});
