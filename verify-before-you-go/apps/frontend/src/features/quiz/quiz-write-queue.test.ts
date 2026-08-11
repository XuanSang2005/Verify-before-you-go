import assert from 'node:assert/strict';
import test from 'node:test';

import { MIL_QUIZ_QUESTIONS } from './quiz-content';
import {
  advanceQuiz,
  answerQuizQuestion,
  createEmptyQuizProgress,
  parseQuizProgress,
  restartQuiz,
  serializeQuizProgress,
  type QuizProgress,
} from './quiz-model';
import { loadQuizProgress, QUIZ_STORAGE_KEY, type QuizStoragePort } from './quiz-storage';
import {
  enqueueQuizWriteAfterConfirmedRead,
  QuizProgressWriteQueue,
  type QuizWriteResult,
} from './quiz-write-queue';

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

class DeferredQuizWrites {
  persistedRaw: string | null = null;
  calls: { progress: QuizProgress; deferred: Deferred<void> }[] = [];

  write = async (progress: QuizProgress) => {
    const deferred = createDeferred<void>();
    this.calls.push({ progress, deferred });
    await deferred.promise;
    this.persistedRaw = serializeQuizProgress(progress);
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function completedProgress() {
  let progress = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
  for (const question of MIL_QUIZ_QUESTIONS) {
    progress = answerQuizQuestion(progress, question.correctOptionId, '2026-08-10T01:01:00.000Z');
    progress = advanceQuiz(progress, '2026-08-10T01:02:00.000Z');
  }
  return progress;
}

test('answer then immediate advance persists the newest current question in order', async () => {
  const writes = new DeferredQuizWrites();
  const writer = new QuizProgressWriteQueue(writes.write);
  const answered = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
    '2026-08-10T01:01:00.000Z',
  );
  const advanced = advanceQuiz(answered, '2026-08-10T01:02:00.000Z');

  const first = writer.enqueue(answered);
  const second = writer.enqueue(advanced);
  await flushMicrotasks();
  assert.equal(writes.calls.length, 1);
  writes.calls[0].deferred.resolve();
  await first;
  await flushMicrotasks();
  assert.equal(writes.calls.length, 2);
  writes.calls[1].deferred.resolve();
  await second;

  const final = parseQuizProgress(writes.persistedRaw);
  assert.equal(final.status, 'valid');
  assert.equal(final.progress.currentQuestionIndex, 1);
  assert.equal(final.progress.answers.length, 1);
});

test('completion then immediate retry persists the newer empty progress', async () => {
  const writes = new DeferredQuizWrites();
  const writer = new QuizProgressWriteQueue(writes.write);
  const complete = completedProgress();
  const retried = restartQuiz(complete, '2026-08-10T02:00:00.000Z');

  const first = writer.enqueue(complete);
  const second = writer.enqueue(retried);
  await flushMicrotasks();
  writes.calls[0].deferred.resolve();
  await first;
  await flushMicrotasks();
  writes.calls[1].deferred.resolve();
  await second;

  const final = parseQuizProgress(writes.persistedRaw);
  assert.equal(final.status, 'valid');
  assert.equal(final.progress.currentQuestionIndex, 0);
  assert.equal(final.progress.answers.length, 0);
  assert.equal(final.progress.completedAt, undefined);
});

test('an old success is stale and cannot clear a newer write failure', async () => {
  const writes = new DeferredQuizWrites();
  const writer = new QuizProgressWriteQueue(writes.write);
  const results: QuizWriteResult[] = [];
  let visibleIssue = 'newer write pending';
  writer.subscribe((result) => {
    results.push(result);
    if (!result.isLatest) return;
    visibleIssue = result.status === 'saved' ? '' : 'newer write failed';
  });
  const answered = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
  );
  const advanced = advanceQuiz(answered);

  const first = writer.enqueue(answered);
  const second = writer.enqueue(advanced);
  await flushMicrotasks();
  writes.calls[0].deferred.resolve();
  await first;
  await flushMicrotasks();
  assert.equal(results[0]?.status, 'saved');
  assert.equal(results[0]?.isLatest, false);
  assert.equal(visibleIssue, 'newer write pending');

  writes.calls[1].deferred.reject(new Error('newer failed'));
  const newerResult = await second;
  await flushMicrotasks();
  assert.equal(newerResult.status, 'failed');
  assert.equal(newerResult.isLatest, true);
  assert.equal(visibleIssue, 'newer write failed');
});

test('remount reads the final state after the serialized queue drains', async () => {
  const values = new Map<string, string>();
  const storage: QuizStoragePort = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  };
  const writer = new QuizProgressWriteQueue(async (progress) => {
    await storage.setItem(QUIZ_STORAGE_KEY, serializeQuizProgress(progress));
  });
  const answered = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
  );
  const advanced = advanceQuiz(answered);

  await Promise.all([writer.enqueue(answered), writer.enqueue(advanced)]);
  const remounted = await loadQuizProgress(storage);
  assert.equal(remounted.progress.currentQuestionIndex, 1);
  assert.equal(remounted.progress.answers.length, 1);
});

test('a failed initial read cannot enqueue or overwrite older saved progress', async () => {
  const oldProgress = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
  );
  let persistedRaw = serializeQuizProgress(oldProgress);
  let writeCalls = 0;
  const writer = new QuizProgressWriteQueue(async (progress) => {
    writeCalls += 1;
    persistedRaw = serializeQuizProgress(progress);
  });
  const sessionProgress = restartQuiz(oldProgress, '2026-08-10T02:00:00.000Z');

  const result = enqueueQuizWriteAfterConfirmedRead(sessionProgress, false, writer);
  assert.equal(result, 'deferred');
  assert.equal(writeCalls, 0);
  assert.equal(persistedRaw, serializeQuizProgress(oldProgress));
});

test('whenIdle waits for writes appended while an earlier write is still pending', async () => {
  const writes = new DeferredQuizWrites();
  const writer = new QuizProgressWriteQueue(writes.write);
  const firstProgress = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
  );
  const secondProgress = advanceQuiz(firstProgress);

  void writer.enqueue(firstProgress);
  await flushMicrotasks();
  let idle = false;
  const barrier = writer.whenIdle().then(() => { idle = true; });
  void writer.enqueue(secondProgress);
  writes.calls[0].deferred.resolve();
  await flushMicrotasks();
  await flushMicrotasks();
  assert.equal(writes.calls.length, 2);
  assert.equal(idle, false);

  writes.calls[1].deferred.resolve();
  await barrier;
  assert.equal(idle, true);
});

test('listener cleanup removes only its own subscription during a remount overlap', async () => {
  const writer = new QuizProgressWriteQueue(async () => undefined);
  const firstResults: QuizWriteResult[] = [];
  const secondResults: QuizWriteResult[] = [];
  const unsubscribeFirst = writer.subscribe((result) => firstResults.push(result));
  writer.subscribe((result) => secondResults.push(result));

  unsubscribeFirst();
  await writer.enqueue(createEmptyQuizProgress('2026-08-10T01:00:00.000Z'));
  await writer.whenIdle();
  assert.equal(firstResults.length, 0);
  assert.equal(secondResults.length, 1);
});
