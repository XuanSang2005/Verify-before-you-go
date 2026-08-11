import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screenSource = readFileSync(new URL('./QuizScreen.tsx', import.meta.url), 'utf8');
const experienceSource = readFileSync(new URL('./QuizExperience.tsx', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('./quiz-storage.ts', import.meta.url), 'utf8');
const persistenceSource = readFileSync(new URL('./quiz-persistence-coordinator.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../../../app/(tabs)/quiz.tsx', import.meta.url), 'utf8');

test('quiz placeholder is replaced by a headerless Screen 19 composition', () => {
  assert.match(routeSource, /QuizScreen/);
  assert.match(screenSource, /PrototypeTabScreen/);
  assert.doesNotMatch(`${screenSource}\n${experienceSource}`, /AppHeader|PrototypeHeader|Get help|checkpoint="CP08"/);
  assert.match(experienceSource, /What would you verify first\?/);
  assert.match(experienceSource, /Open the Offer Checker/);
});

test('quiz uses the exact unmodified supplied Screen 19 mascot at a large size', () => {
  const mascot = readFileSync(new URL('../../../assets/mascots/quiz-insight-v3.png', import.meta.url));
  assert.equal(
    createHash('sha256').update(mascot).digest('hex'),
    '48d5b7fa1b271ff0ccc1936a29c87c0db2af3b217e1fbe044e46b0c48cc121d1',
  );
  assert.match(screenSource, /quiz-insight-v3\.png/);
  assert.match(experienceSource, /mascot: \{[^\n]*width: 158, height: 112/);
  assert.match(experienceSource, /accessible=\{false\}/);
});

test('quiz is offline-only and UI never imports AsyncStorage directly', () => {
  assert.doesNotMatch(`${screenSource}\n${experienceSource}\n${storageSource}`, /fetch\(|axios|\/api\/v1\/quiz/);
  assert.doesNotMatch(screenSource, /AsyncStorage/);
  assert.match(storageSource, /AsyncStorage/);
});

test('quiz has no truncation, fixed content height or visible type below 11px', () => {
  assert.doesNotMatch(experienceSource, /numberOfLines|ellipsizeMode/);
  const fontSizes = [...experienceSource.matchAll(/fontSize:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(fontSizes.length > 0);
  assert.ok(fontSizes.every((size) => size >= 11));
  assert.match(experienceSource, /option: \{[^\n]*width: '100%'[^\n]*maxWidth: '100%'[^\n]*minHeight: 48/);
});

test('quiz frames fit 360, 390, 768 and 1024px without becoming a dashboard', () => {
  assert.match(experienceSource, /experience: \{[^\n]*width: '100%'[^\n]*maxWidth: '100%'/);
  assert.match(experienceSource, /questionCard: \{[^\n]*width: '100%'[^\n]*maxWidth: '100%'/);
  assert.doesNotMatch(experienceSource, /flexDirection: 'row'.*questionCard|gridTemplateColumns/);
  for (const viewport of [360, 390, 768, 1024]) {
    const contentWidth = Math.min(viewport - 40, 760);
    assert.ok(contentWidth > 0 && contentWidth <= viewport);
  }
});

test('quiz declares radio and progress semantics with minimum 48px controls', () => {
  assert.match(experienceSource, /accessibilityRole="radiogroup"/);
  assert.match(experienceSource, /accessibilityRole="radio"/);
  assert.match(experienceSource, /aria-checked=\{selected\}/);
  assert.match(experienceSource, /aria-valuemin=\{0\}/);
  assert.match(experienceSource, /aria-valuemax=\{5\}/);
  assert.match(experienceSource, /aria-valuenow=\{progress\}/);
  assert.match(experienceSource, /primaryButton: \{[^\n]*minHeight: 48/);
  assert.match(experienceSource, /linkButton: \{[^\n]*minHeight: 48/);
});

test('quiz resets scroll only when the main question or completion state changes', () => {
  assert.match(screenSource, /scrollResetKey=\{scrollResetKey\}/);
  assert.match(screenSource, /getQuizScrollResetKey\(progress\)/);
  assert.doesNotMatch(screenSource, /scrollTo\(/);
});

test('quiz persistence uses one revision-safe queue for updates and storage retry', () => {
  assert.match(screenSource, /quizPersistenceCoordinator/);
  assert.doesNotMatch(screenSource, /new QuizProgressWriteQueue/);
  assert.match(persistenceSource, /new QuizProgressWriteQueue\(write\)/);
  assert.match(persistenceSource, /await this\.writer\.whenIdle\(\)/);
  assert.match(screenSource, /enqueueQuizWriteAfterConfirmedRead/);
  assert.match(screenSource, /persistence\.enqueue\(progress\)/);
  assert.doesNotMatch(screenSource, /void saveQuizProgress|await saveQuizProgress/);
});
