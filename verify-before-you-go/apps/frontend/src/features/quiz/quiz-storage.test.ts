import assert from 'node:assert/strict';
import test from 'node:test';

import { MIL_QUIZ_QUESTIONS } from './quiz-content';
import {
  answerQuizQuestion,
  createEmptyQuizProgress,
  getQuizScore,
  serializeQuizProgress,
} from './quiz-model';
import {
  QUIZ_STORAGE_KEY,
  loadQuizProgress,
  saveQuizProgress,
  type QuizStoragePort,
} from './quiz-storage';

class MemoryQuizStorage implements QuizStoragePort {
  values = new Map<string, string>();
  failReads = 0;
  failWrites = 0;

  async getItem(key: string) {
    if (this.failReads > 0) {
      this.failReads -= 1;
      throw new Error('read failed');
    }
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    if (this.failWrites > 0) {
      this.failWrites -= 1;
      throw new Error('write failed');
    }
    this.values.set(key, value);
  }
}

test('persists partial quiz progress across a remount using IDs and timestamps only', async () => {
  const storage = new MemoryQuizStorage();
  const progress = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
    '2026-08-10T01:01:00.000Z',
  );
  await saveQuizProgress(progress, storage);
  const remounted = await loadQuizProgress(storage);
  const raw = storage.values.get(QUIZ_STORAGE_KEY) ?? '';

  assert.equal(remounted.status, 'valid');
  assert.equal(remounted.progress.answers.length, 1);
  assert.equal(getQuizScore(remounted.progress), 1);
  assert.doesNotMatch(raw, /passport photo|recruiter sends|viral post|watchlist|redact personal/i);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), [
    'answers', 'contentVersion', 'createdAt', 'currentQuestionIndex', 'schemaVersion', 'updatedAt',
  ]);
});

test('replaces corrupt or old-version content with canonical fresh progress', async () => {
  for (const raw of ['corrupt', JSON.stringify({ schemaVersion: 1, contentVersion: 'old' })]) {
    const storage = new MemoryQuizStorage();
    storage.values.set(QUIZ_STORAGE_KEY, raw);
    const loaded = await loadQuizProgress(storage, '2026-08-10T02:00:00.000Z');

    assert.equal(loaded.status, 'recovered');
    assert.equal(loaded.progress.answers.length, 0);
    assert.equal(storage.values.get(QUIZ_STORAGE_KEY), serializeQuizProgress(loaded.progress));
  }
});

test('surfaces storage read and write failures to the UI', async () => {
  const readFailure = new MemoryQuizStorage();
  readFailure.failReads = 1;
  await assert.rejects(() => loadQuizProgress(readFailure), /read failed/);

  const writeFailure = new MemoryQuizStorage();
  writeFailure.failWrites = 1;
  await assert.rejects(
    () => saveQuizProgress(createEmptyQuizProgress(), writeFailure),
    /write failed/,
  );
});
