import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { MIL_QUIZ_QUESTIONS } from './quiz-content';
import {
  answerQuizQuestion,
  createEmptyQuizProgress,
  parseQuizProgress,
  serializeQuizProgress,
  type QuizProgress,
} from './quiz-model';
import { QuizPersistenceCoordinator } from './quiz-persistence-coordinator';
import {
  readQuizProgress,
  saveQuizProgress,
  type QuizStoragePort,
} from './quiz-storage';
import { QuizScreenController } from './QuizScreen';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

type Harness = {
  container: HTMLDivElement;
  root: Root;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

class DeferredQuizStorage implements QuizStoragePort {
  getCalls = 0;
  pendingWrites: { raw: string; deferred: Deferred<void> }[] = [];
  raw: string | null;
  readSteps: (() => Promise<string | null>)[] = [];
  setCalls = 0;
  deferWrites = false;

  constructor(raw: string | null) {
    this.raw = raw;
  }

  async getItem() {
    this.getCalls += 1;
    const step = this.readSteps.shift();
    return step ? step() : this.raw;
  }

  async setItem(_key: string, value: string) {
    this.setCalls += 1;
    if (!this.deferWrites) {
      this.raw = value;
      return;
    }
    const pending = deferred<void>();
    this.pendingWrites.push({ raw: value, deferred: pending });
    await pending.promise;
    this.raw = value;
  }

  resolveWrite(index: number) {
    this.pendingWrites[index].deferred.resolve();
  }
}

function persistenceFor(storage: QuizStoragePort) {
  return new QuizPersistenceCoordinator(
    () => readQuizProgress(storage),
    (progress) => saveQuizProgress(progress, storage),
  );
}

async function mountController(persistence: QuizPersistenceCoordinator): Promise<Harness> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QuizScreenController
        mascotSource={{ uri: 'quiz-insight-v3.png' }}
        onOpenChecker={() => undefined}
        persistence={persistence}
      />,
    );
  });
  return { container, root };
}

async function cleanup(harness: Harness) {
  await act(async () => harness.root.unmount());
  harness.container.remove();
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function element(container: HTMLElement, testID: string): HTMLElement {
  const match = container.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!match) throw new Error(`${testID} was not rendered`);
  return match;
}

function firstCorrectOption(container: HTMLElement): HTMLElement {
  return element(container, `quiz-option-${MIL_QUIZ_QUESTIONS[0].correctOptionId}`);
}

async function failInitialRead(storage: DeferredQuizStorage, persistence: QuizPersistenceCoordinator) {
  storage.readSteps.push(async () => { throw new Error('initial read failed'); });
  const harness = await mountController(persistence);
  await settle();
  expect(element(harness.container, 'quiz-storage-error').textContent).toContain('could not be read');
  return harness;
}

describe('CP08 rendered persistence controller races', () => {
  it('waits for a delayed write from the unmounted screen before the new mount hydrates', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    const storage = new DeferredQuizStorage(serializeQuizProgress(empty));
    const persistence = persistenceFor(storage);
    const first = await mountController(persistence);
    await settle();

    storage.deferWrites = true;
    await act(async () => firstCorrectOption(first.container).click());
    await settle();
    expect(storage.pendingWrites).toHaveLength(1);
    await cleanup(first);

    const remounted = await mountController(persistence);
    await settle();
    expect(storage.getCalls).toBe(1);
    expect(remounted.container.querySelector('[data-testid="quiz-loading"]')).not.toBeNull();

    await act(async () => storage.resolveWrite(0));
    await settle();
    expect(storage.getCalls).toBe(2);
    expect(firstCorrectOption(remounted.container).getAttribute('aria-checked')).toBe('true');
    expect(remounted.container.querySelector('[data-testid="quiz-feedback"]')).not.toBeNull();
    await cleanup(remounted);
  });

  it('does not let the fresh remount overwrite the delayed newest progress with its empty snapshot', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    const storage = new DeferredQuizStorage(serializeQuizProgress(empty));
    const persistence = persistenceFor(storage);
    const first = await mountController(persistence);
    await settle();

    storage.deferWrites = true;
    await act(async () => firstCorrectOption(first.container).click());
    await settle();
    await cleanup(first);
    const remounted = await mountController(persistence);
    await settle();

    expect(storage.setCalls).toBe(1);
    await act(async () => storage.resolveWrite(0));
    await settle();
    await persistence.whenIdle();
    const saved = parseQuizProgress(storage.raw);
    expect(saved.progress.answers).toHaveLength(1);
    expect(storage.setCalls).toBe(1);
    await cleanup(remounted);
  });

  it('coalesces two immediate Retry taps and keeps retry plus answers disabled while the read is pending', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    const storage = new DeferredQuizStorage(serializeQuizProgress(empty));
    const persistence = persistenceFor(storage);
    const retryRead = deferred<string | null>();
    const harness = await failInitialRead(storage, persistence);
    storage.readSteps.push(() => retryRead.promise);
    const retry = element(harness.container, 'quiz-storage-retry');

    await act(async () => {
      retry.click();
      retry.click();
      await Promise.resolve();
    });

    expect(storage.getCalls).toBe(2);
    const pendingRetry = element(harness.container, 'quiz-storage-retry');
    expect(pendingRetry.getAttribute('aria-disabled')).toBe('true');
    expect(pendingRetry.textContent).toBe('Retrying storage…');
    expect(firstCorrectOption(harness.container).getAttribute('aria-disabled')).toBe('true');

    retryRead.resolve(serializeQuizProgress(empty));
    await settle();
    expect(harness.container.querySelector('[data-testid="quiz-storage-error"]')).toBeNull();
    await cleanup(harness);
  });

  it('coalesces two immediate Retry taps into one queued write after a save failure', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    let raw = serializeQuizProgress(empty);
    let setCalls = 0;
    const retryWrite = deferred<void>();
    const storage: QuizStoragePort = {
      getItem: async () => raw,
      setItem: async (_key, value) => {
        setCalls += 1;
        if (setCalls === 1) throw new Error('first save failed');
        await retryWrite.promise;
        raw = value;
      },
    };
    const persistence = persistenceFor(storage);
    const harness = await mountController(persistence);
    await settle();
    await act(async () => firstCorrectOption(harness.container).click());
    await settle();
    expect(element(harness.container, 'quiz-storage-error').textContent).toContain('could not be saved');
    const retry = element(harness.container, 'quiz-storage-retry');

    await act(async () => {
      retry.click();
      retry.click();
      await Promise.resolve();
    });
    await settle();

    expect(setCalls).toBe(2);
    expect(element(harness.container, 'quiz-storage-retry').getAttribute('aria-disabled')).toBe('true');
    retryWrite.resolve();
    await settle();
    expect(harness.container.querySelector('[data-testid="quiz-storage-error"]')).toBeNull();
    expect(parseQuizProgress(raw).progress.answers).toHaveLength(1);
    await cleanup(harness);
  });

  it('ignores an older retry failure after a newer mount hydrates successfully', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    const storage = new DeferredQuizStorage(serializeQuizProgress(empty));
    const persistence = persistenceFor(storage);
    const oldRetry = deferred<string | null>();
    const first = await failInitialRead(storage, persistence);
    storage.readSteps.push(() => oldRetry.promise);
    await act(async () => element(first.container, 'quiz-storage-retry').click());
    await settle();
    await cleanup(first);

    const remounted = await mountController(persistence);
    await settle();
    expect(remounted.container.querySelector('[data-testid="quiz-storage-error"]')).toBeNull();
    oldRetry.reject(new Error('stale retry failed'));
    await settle();
    expect(remounted.container.querySelector('[data-testid="quiz-storage-error"]')).toBeNull();
    expect(remounted.container.querySelector('[data-testid="quiz-loading"]')).toBeNull();
    await cleanup(remounted);
  });

  it('ignores an older retry success instead of replacing newer hydrated progress', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    const answered: QuizProgress = answerQuizQuestion(
      empty,
      MIL_QUIZ_QUESTIONS[0].correctOptionId,
      '2026-08-10T01:01:00.000Z',
    );
    const storage = new DeferredQuizStorage(serializeQuizProgress(answered));
    const persistence = persistenceFor(storage);
    const oldRetry = deferred<string | null>();
    const first = await failInitialRead(storage, persistence);
    storage.readSteps.push(() => oldRetry.promise);
    await act(async () => element(first.container, 'quiz-storage-retry').click());
    await settle();
    await cleanup(first);

    const remounted = await mountController(persistence);
    await settle();
    expect(firstCorrectOption(remounted.container).getAttribute('aria-checked')).toBe('true');
    oldRetry.resolve('corrupt stale retry data');
    await settle();
    await persistence.whenIdle();
    expect(firstCorrectOption(remounted.container).getAttribute('aria-checked')).toBe('true');
    expect(remounted.container.querySelector('[data-testid="quiz-feedback"]')).not.toBeNull();
    expect(parseQuizProgress(storage.raw).progress.answers).toHaveLength(1);
    expect(storage.setCalls).toBe(0);
    await cleanup(remounted);
  });

  it('does not update state or warn when a retry resolves after unmount', async () => {
    const empty = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
    const storage = new DeferredQuizStorage(serializeQuizProgress(empty));
    const persistence = persistenceFor(storage);
    const retryRead = deferred<string | null>();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const harness = await failInitialRead(storage, persistence);
    storage.readSteps.push(() => retryRead.promise);
    await act(async () => element(harness.container, 'quiz-storage-retry').click());
    await settle();
    await cleanup(harness);

    retryRead.resolve(serializeQuizProgress(empty));
    await settle();
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/state update.*unmounted|unmounted component/i);
    consoleError.mockRestore();
  });
});
