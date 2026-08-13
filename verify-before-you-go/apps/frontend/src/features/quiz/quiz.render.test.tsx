import {
  act,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';

import { QuizExperience } from './QuizExperience';
import { MIL_QUIZ_QUESTIONS } from './quiz-content';
import {
  advanceQuiz,
  answerQuizQuestion,
  createEmptyQuizProgress,
  getQuizScrollResetKey,
  restartQuiz,
  type QuizProgress,
} from './quiz-model';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-router', () => ({
  Link: function MockLink({ asChild, children, href }: { asChild?: boolean; children: ReactNode; href: string }) {
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, { href });
    }
    return <a href={href}>{children}</a>;
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = {
  checkerCalls: () => number;
  container: HTMLDivElement;
  getOption: (optionId: string) => HTMLElement;
  root: Root;
};

function QuizHarness({ onChecker }: { onChecker: () => void }) {
  const [progress, setProgress] = useState<QuizProgress>(() => createEmptyQuizProgress('2026-08-10T01:00:00.000Z'));
  return (
    <QuizExperience
      mascotSource={{ uri: 'quiz-insight-v3.png' }}
      onAdvance={() => setProgress((current) => advanceQuiz(current, '2026-08-10T01:02:00.000Z'))}
      onAnswer={(optionId) => setProgress((current) => answerQuizQuestion(current, optionId, '2026-08-10T01:01:00.000Z'))}
      onOpenChecker={onChecker}
      onRetry={() => setProgress((current) => restartQuiz(current, '2026-08-10T02:00:00.000Z'))}
      progress={progress}
      webKeyboardEnabled
    />
  );
}

function ScrollResetHarness() {
  const [progress, setProgress] = useState<QuizProgress>(() => createEmptyQuizProgress('2026-08-10T01:00:00.000Z'));
  return (
    <PrototypeTabScreen
      scrollResetKey={getQuizScrollResetKey(progress)}
      testID="quiz-scroll-reset-harness"
    >
      <QuizExperience
        mascotSource={{ uri: 'quiz-insight-v3.png' }}
        onAdvance={() => setProgress((current) => advanceQuiz(current, '2026-08-10T01:02:00.000Z'))}
        onAnswer={(optionId) => setProgress((current) => answerQuizQuestion(current, optionId, '2026-08-10T01:01:00.000Z'))}
        onOpenChecker={() => undefined}
        onRetry={() => setProgress((current) => restartQuiz(current, '2026-08-10T02:00:00.000Z'))}
        progress={progress}
        webKeyboardEnabled
      />
    </PrototypeTabScreen>
  );
}

async function renderQuiz(): Promise<Harness> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let checkerCalls = 0;
  await act(async () => {
    root.render(<QuizHarness onChecker={() => { checkerCalls += 1; }} />);
  });
  return {
    checkerCalls: () => checkerCalls,
    container,
    getOption: (optionId) => {
      const option = container.querySelector<HTMLElement>(`[data-testid="quiz-option-${optionId}"]`);
      if (!option) throw new Error(`Quiz option ${optionId} not found`);
      return option;
    },
    root,
  };
}

async function renderScrollQuiz(): Promise<Harness> {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  const container = document.createElement('div');
  container.style.width = '360px';
  container.style.height = '800px';
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<ScrollResetHarness />));
  return {
    checkerCalls: () => 0,
    container,
    getOption: (optionId) => {
      const option = container.querySelector<HTMLElement>(`[data-testid="quiz-option-${optionId}"]`);
      if (!option) throw new Error(`Quiz option ${optionId} not found`);
      return option;
    },
    root,
  };
}

async function cleanup(harness: Harness) {
  await act(async () => harness.root.unmount());
  harness.container.remove();
}

async function click(container: HTMLElement, testId: string) {
  const control = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!control) throw new Error(`${testId} not found`);
  await act(async () => control.click());
}

describe('CP08 rendered quiz interactions', () => {
  it('selects an answer, exposes checked state and shows immediate educational feedback', async () => {
    const harness = await renderQuiz();
    const correctId = MIL_QUIZ_QUESTIONS[0].correctOptionId;

    expect(harness.getOption(correctId).getAttribute('aria-checked')).toBe('false');
    await act(async () => harness.getOption(correctId).click());

    expect(harness.getOption(correctId).getAttribute('aria-checked')).toBe('true');
    expect(harness.container.querySelector('[data-testid="quiz-feedback"]')?.textContent).toContain('Good identity-protection choice.');
    expect(harness.container.querySelector('[data-testid="quiz-transfer"]')).not.toBeNull();
    expect(harness.container.querySelector('[data-testid="quiz-next"]')).not.toBeNull();
    await cleanup(harness);
  });

  it('uses roving tabIndex and arrow keys to select and focus the adjacent radio', async () => {
    const harness = await renderQuiz();
    const [first, second] = MIL_QUIZ_QUESTIONS[0].options;
    const firstElement = harness.getOption(first.id);
    const secondElement = harness.getOption(second.id);

    expect(firstElement.tabIndex).toBe(0);
    expect(secondElement.tabIndex).toBe(-1);
    await act(async () => firstElement.focus());
    await act(async () => {
      firstElement.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowDown',
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(harness.getOption(second.id).getAttribute('aria-checked')).toBe('true');
    expect(harness.getOption(second.id).tabIndex).toBe(0);
    expect(document.activeElement).toBe(harness.getOption(second.id));
    await cleanup(harness);
  });

  it('completes all five questions, reports the local score and retry clears progress', async () => {
    const harness = await renderQuiz();

    for (const question of MIL_QUIZ_QUESTIONS) {
      await act(async () => harness.getOption(question.correctOptionId).click());
      await click(harness.container, 'quiz-next');
    }

    expect(harness.container.querySelector('[data-testid="quiz-completion"]')?.textContent).toContain('5 / 5');
    const progressbar = harness.container.querySelector<HTMLElement>('[data-testid="quiz-progress"]');
    expect(progressbar?.getAttribute('aria-valuemin')).toBe('0');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('5');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('5');

    await click(harness.container, 'quiz-retry');
    expect(harness.container.querySelector('[data-testid="quiz-completion"]')).toBeNull();
    expect(harness.container.textContent).toContain('Question 1 of 5');
    expect(harness.getOption(MIL_QUIZ_QUESTIONS[0].correctOptionId).getAttribute('aria-checked')).toBe('false');
    await cleanup(harness);
  });

  it('opens the Offer Checker from question and completion states', async () => {
    const harness = await renderQuiz();
    await click(harness.container, 'quiz-open-checker');
    expect(harness.checkerCalls()).toBe(1);

    for (const question of MIL_QUIZ_QUESTIONS) {
      await act(async () => harness.getOption(question.correctOptionId).click());
      await click(harness.container, 'quiz-next');
    }
    await click(harness.container, 'quiz-open-checker');
    expect(harness.checkerCalls()).toBe(2);
    await cleanup(harness);
  });

  it('keeps visual option copy out of duplicate accessibility nodes', async () => {
    const harness = await renderQuiz();
    for (const option of MIL_QUIZ_QUESTIONS[0].options) {
      const element = harness.getOption(option.id);
      expect(element.getAttribute('aria-label')).toContain(option.label);
      expect(element.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
    await cleanup(harness);
  });

  it('resets the 360x800 ScrollView only for Next, completion and retry transitions', async () => {
    const originalScroll = HTMLElement.prototype.scroll;
    function mockScroll(this: HTMLElement, options: ScrollToOptions | number, y?: number) {
      this.scrollTop = typeof options === 'number' ? (y ?? 0) : (options.top ?? 0);
    }
    Object.defineProperty(HTMLElement.prototype, 'scroll', {
      configurable: true,
      writable: true,
      value: mockScroll,
    });
    const harness = await renderScrollQuiz();
    const scrollView = harness.container.querySelector<HTMLElement>('[data-testid="vbyg-vertical-scroll"]');
    if (!scrollView) throw new Error('Vertical ScrollView not found');

    scrollView.scrollTop = 720;
    await act(async () => harness.getOption(MIL_QUIZ_QUESTIONS[0].correctOptionId).click());
    expect(scrollView.scrollTop).toBe(720);
    await click(harness.container, 'quiz-next');
    expect(scrollView.scrollTop).toBe(0);
    expect(harness.container.querySelector('[data-testid="quiz-kicker"]')?.textContent).toContain('Question 2 of 5');
    expect(harness.container.querySelector('[data-testid="quiz-heading"]')?.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(harness.container.querySelector('[data-testid="quiz-heading"]')?.getBoundingClientRect().bottom).toBeLessThanOrEqual(800);

    for (const question of MIL_QUIZ_QUESTIONS.slice(1)) {
      await act(async () => harness.getOption(question.correctOptionId).click());
      if (question.id === 'redacted-observations') scrollView.scrollTop = 720;
      await click(harness.container, 'quiz-next');
    }
    expect(scrollView.scrollTop).toBe(0);
    expect(harness.container.querySelector('[data-testid="quiz-kicker"]')?.textContent).toContain('Practice complete');
    expect(harness.container.querySelector('[data-testid="quiz-heading"]')?.textContent).toBe('Keep checking the evidence.');

    scrollView.scrollTop = 720;
    await click(harness.container, 'quiz-retry');
    expect(scrollView.scrollTop).toBe(0);
    expect(harness.container.querySelector('[data-testid="quiz-kicker"]')?.textContent).toContain('Question 1 of 5');
    expect(harness.container.querySelector('[data-testid="quiz-heading"]')?.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(harness.container.querySelector('[data-testid="quiz-heading"]')?.getBoundingClientRect().bottom).toBeLessThanOrEqual(800);

    await cleanup(harness);
    Object.defineProperty(HTMLElement.prototype, 'scroll', {
      configurable: true,
      writable: true,
      value: originalScroll,
    });
  });
});
