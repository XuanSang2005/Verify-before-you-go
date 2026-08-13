import userEvent from '@testing-library/user-event';
import {
  act,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { MIL_QUIZ_QUESTIONS } from '../quiz/quiz-content';
import { QuizScreenController } from '../quiz/QuizScreen';
import {
  advanceQuiz,
  answerQuizQuestion,
  createEmptyQuizProgress,
  type QuizProgress,
} from '../quiz/quiz-model';
import type { QuizPersistenceCoordinatorPort } from '../quiz/quiz-persistence-coordinator';
import { RewardProvider } from './RewardContext';
import { RewardVoucherScreen } from './RewardVoucherScreen';

const routeLifecycle = vi.hoisted(() => ({
  currentPath: '/rewards/voucher',
  navigate: undefined as undefined | ((href: string) => void),
}));

vi.mock('expo-router', () => ({
  Link: function MockLifecycleLink({
    asChild,
    children,
    href,
  }: {
    asChild?: boolean;
    children: ReactNode;
    href: string;
  }) {
    const navigate = (event: { preventDefault: () => void }) => {
      event.preventDefault();
      routeLifecycle.navigate?.(href);
    };
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, { href, onPress: navigate });
    }
    return <a href={href} onClick={navigate}>{children}</a>;
  },
  router: { push: vi.fn(), replace: vi.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const active = routeLifecycle.currentPath === '/rewards/voucher';
    useEffect(() => {
      if (!active) return undefined;
      return callback();
    }, [active, callback]);
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(async () => true),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children, testID }: { children?: ReactNode; testID?: string }) {
    return <div data-testid={testID}>{children}</div>;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = { container: HTMLDivElement; root: Root };

function quizAwaitingPerfectCompletion(): QuizProgress {
  let progress = createEmptyQuizProgress('2026-08-13T01:00:00.000Z');
  MIL_QUIZ_QUESTIONS.forEach((question, index) => {
    progress = answerQuizQuestion(
      progress,
      question.correctOptionId,
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

function RouteLifecycleScenes({
  initialPath,
  quizProgress,
}: {
  initialPath: '/quiz' | '/rewards/voucher';
  quizProgress: QuizProgress;
}) {
  const [path, setPath] = useState(initialPath);
  useEffect(() => {
    routeLifecycle.currentPath = path;
    routeLifecycle.navigate = (href) => {
      routeLifecycle.currentPath = href;
      window.history.pushState({}, '', href);
      setPath(href as '/quiz' | '/rewards/voucher');
    };
    return () => { routeLifecycle.navigate = undefined; };
  }, [path]);

  return (
    <>
      <div aria-hidden={path !== '/rewards/voucher'} data-testid="voucher-route-scene">
        <RewardVoucherScreen />
      </div>
      <div aria-hidden={path !== '/quiz'} data-testid="quiz-route-scene">
        <QuizScreenController
          mascotSource={{ uri: 'quiz-insight-v3.png' }}
          onOpenChecker={() => undefined}
          persistence={quizPersistence(quizProgress)}
        />
      </div>
    </>
  );
}

async function renderRouteLifecycle(
  initialPath: '/quiz' | '/rewards/voucher',
  quizProgress = createEmptyQuizProgress('2026-08-13T01:00:00.000Z'),
): Promise<Harness> {
  window.history.replaceState({}, '', initialPath);
  routeLifecycle.currentPath = initialPath;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <RewardProvider>
        <RouteLifecycleScenes initialPath={initialPath} quizProgress={quizProgress} />
      </RewardProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  await flushAnimationFrames();
  return { container, root };
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

async function cleanup(harness: Harness) {
  await act(async () => harness.root.unmount());
  harness.container.remove();
  routeLifecycle.navigate = undefined;
  window.history.replaceState({}, '', '/');
}

describe.each(['mouse', 'keyboard'] as const)('Voucher route focus cleanup via %s', (activation) => {
  it('releases a focused Go to Quiz link when the real route lifecycle blurs Voucher', async () => {
    const harness = await renderRouteLifecycle('/rewards/voucher');
    const goToQuiz = control(harness.container, 'voucher-go-quiz');
    await act(async () => goToQuiz.focus());
    expect(document.activeElement).toBe(goToQuiz);

    if (activation === 'mouse') {
      await act(async () => goToQuiz.click());
    } else {
      const keyboard = userEvent.setup();
      await act(async () => keyboard.keyboard('{Enter}'));
    }
    await flushAnimationFrames();

    expect(window.location.pathname).toBe('/quiz');
    expect(control(harness.container, 'voucher-route-scene').getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement?.closest('[aria-hidden="true"]')).toBeNull();
    await cleanup(harness);
  });
});

it('focuses the visible Voucher heading after a perfect Quiz opens the demo voucher', async () => {
  const harness = await renderRouteLifecycle('/quiz', quizAwaitingPerfectCompletion());
  await act(async () => control(harness.container, 'quiz-next').click());
  const viewVoucher = control(harness.container, 'view-voucher');
  expect(viewVoucher.closest('[aria-hidden="true"]')).toBeNull();
  await act(async () => viewVoucher.click());
  await flushAnimationFrames();

  expect(window.location.pathname).toBe('/rewards/voucher');
  expect(document.activeElement?.id).toBe('voucher-screen-heading');
  expect(document.activeElement?.textContent).toBe('Your voucher is ready.');
  expect(document.activeElement?.closest('[aria-hidden="true"]')).toBeNull();
  await cleanup(harness);
});
