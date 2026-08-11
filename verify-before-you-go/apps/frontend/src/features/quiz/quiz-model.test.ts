import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIL_QUIZ_CONTENT_VERSION_FIXTURE,
  requiredTopicIds,
} from './quiz-test-fixtures';
import { MIL_QUIZ_CONTENT_VERSION, MIL_QUIZ_QUESTIONS } from './quiz-content';
import {
  advanceQuiz,
  answerQuizQuestion,
  createEmptyQuizProgress,
  getAdjacentQuizOptionId,
  getCurrentQuizAnswer,
  getQuizScore,
  getQuizScrollResetKey,
  isQuizComplete,
  parseQuizProgress,
  restartQuiz,
  serializeQuizProgress,
} from './quiz-model';

test('bundles exactly five versioned questions for all required MIL topics', () => {
  assert.equal(MIL_QUIZ_CONTENT_VERSION, MIL_QUIZ_CONTENT_VERSION_FIXTURE);
  assert.equal(MIL_QUIZ_QUESTIONS.length, 5);
  assert.deepEqual(MIL_QUIZ_QUESTIONS.map((question) => question.id), requiredTopicIds);
  for (const question of MIL_QUIZ_QUESTIONS) {
    assert.equal(question.options.length, 3);
    assert.ok(question.options.some((option) => option.id === question.correctOptionId));
  }
  assert.equal(
    MIL_QUIZ_QUESTIONS[0].tryFeedback,
    'Sending the image immediately—or adding a watermark—does not independently verify the recruiter or make the urgent request appropriate.',
  );
});

test('answers once, gives a local score and advances only after an answer', () => {
  const initial = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
  assert.equal(advanceQuiz(initial), initial);

  const correct = answerQuizQuestion(initial, MIL_QUIZ_QUESTIONS[0].correctOptionId, '2026-08-10T01:01:00.000Z');
  const ignoredSecondAnswer = answerQuizQuestion(correct, MIL_QUIZ_QUESTIONS[0].options[0].id);
  assert.equal(ignoredSecondAnswer, correct);
  assert.equal(getCurrentQuizAnswer(correct)?.questionId, 'passport-urgency');
  assert.equal(getQuizScore(correct), 1);
  assert.equal(getQuizScrollResetKey(correct), getQuizScrollResetKey(initial));

  const next = advanceQuiz(correct, '2026-08-10T01:02:00.000Z');
  assert.equal(next.currentQuestionIndex, 1);
  assert.notEqual(getQuizScrollResetKey(next), getQuizScrollResetKey(correct));
  assert.equal(getCurrentQuizAnswer(next), undefined);
});

test('completes all five topics, derives score and retries from question one', () => {
  let progress = createEmptyQuizProgress('2026-08-10T01:00:00.000Z');
  for (const question of MIL_QUIZ_QUESTIONS) {
    progress = answerQuizQuestion(progress, question.correctOptionId, `2026-08-10T01:0${progress.currentQuestionIndex + 1}:00.000Z`);
    progress = advanceQuiz(progress, `2026-08-10T01:1${progress.currentQuestionIndex}:00.000Z`);
  }

  assert.equal(isQuizComplete(progress), true);
  assert.equal(getQuizScore(progress), 5);
  assert.equal(progress.answers.length, 5);
  assert.equal(getQuizScrollResetKey(progress), 'quiz-completion');

  const retried = restartQuiz(progress, '2026-08-10T02:00:00.000Z');
  assert.equal(isQuizComplete(retried), false);
  assert.equal(retried.answers.length, 0);
  assert.equal(retried.currentQuestionIndex, 0);
  assert.equal(getQuizScrollResetKey(retried), 'quiz-question-0');
  assert.equal(retried.createdAt, progress.createdAt);
});

test('parses canonical progress and recovers corrupt or outdated local data', () => {
  const progress = answerQuizQuestion(
    createEmptyQuizProgress('2026-08-10T01:00:00.000Z'),
    MIL_QUIZ_QUESTIONS[0].correctOptionId,
    '2026-08-10T01:01:00.000Z',
  );
  const valid = parseQuizProgress(serializeQuizProgress(progress));
  assert.equal(valid.status, 'valid');
  assert.deepEqual(valid.progress, progress);

  for (const raw of [
    'not-json',
    JSON.stringify({ schemaVersion: 99 }),
    JSON.stringify({ ...JSON.parse(serializeQuizProgress(progress)), contentVersion: 'old-content' }),
    JSON.stringify({ ...JSON.parse(serializeQuizProgress(progress)), answers: [{ questionId: 'wrong', optionId: 'x' }] }),
  ]) {
    const result = parseQuizProgress(raw, '2026-08-10T03:00:00.000Z');
    assert.equal(result.status, 'recovered');
    assert.equal(result.progress.answers.length, 0);
  }
});

test('supports wrapping arrow-key and Home/End radio navigation', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(getAdjacentQuizOptionId(ids, 'a', 'ArrowRight'), 'b');
  assert.equal(getAdjacentQuizOptionId(ids, 'a', 'ArrowLeft'), 'c');
  assert.equal(getAdjacentQuizOptionId(ids, 'c', 'ArrowDown'), 'a');
  assert.equal(getAdjacentQuizOptionId(ids, 'b', 'ArrowUp'), 'a');
  assert.equal(getAdjacentQuizOptionId(ids, 'b', 'Home'), 'a');
  assert.equal(getAdjacentQuizOptionId(ids, 'b', 'End'), 'c');
  assert.equal(getAdjacentQuizOptionId(ids, 'b', 'Enter'), undefined);
});
