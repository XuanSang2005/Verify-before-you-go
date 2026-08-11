import {
  MIL_QUIZ_CONTENT_VERSION,
  MIL_QUIZ_QUESTIONS,
  getQuizQuestion,
  isQuizOptionId,
  type QuizTopicId,
} from './quiz-content';

export const QUIZ_SCHEMA_VERSION = 1 as const;

export type QuizAnswer = {
  questionId: QuizTopicId;
  optionId: string;
  answeredAt: string;
};

export type QuizProgress = {
  schemaVersion: typeof QUIZ_SCHEMA_VERSION;
  contentVersion: typeof MIL_QUIZ_CONTENT_VERSION;
  currentQuestionIndex: number;
  answers: QuizAnswer[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type QuizParseStatus = 'empty' | 'valid' | 'recovered';

export function createEmptyQuizProgress(timestamp = new Date().toISOString()): QuizProgress {
  return {
    schemaVersion: QUIZ_SCHEMA_VERSION,
    contentVersion: MIL_QUIZ_CONTENT_VERSION,
    currentQuestionIndex: 0,
    answers: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getQuizScore(progress: QuizProgress): number {
  return progress.answers.filter((answer) => (
    getQuizQuestion(answer.questionId)?.correctOptionId === answer.optionId
  )).length;
}

export function getCurrentQuizAnswer(progress: QuizProgress): QuizAnswer | undefined {
  const question = MIL_QUIZ_QUESTIONS[progress.currentQuestionIndex];
  return question
    ? progress.answers.find((answer) => answer.questionId === question.id)
    : undefined;
}

export function isQuizComplete(progress: QuizProgress): boolean {
  return Boolean(progress.completedAt) && progress.answers.length === MIL_QUIZ_QUESTIONS.length;
}

export function getQuizScrollResetKey(progress: QuizProgress): string {
  return isQuizComplete(progress)
    ? 'quiz-completion'
    : `quiz-question-${progress.currentQuestionIndex}`;
}

export function answerQuizQuestion(
  progress: QuizProgress,
  optionId: string,
  timestamp = new Date().toISOString(),
): QuizProgress {
  if (isQuizComplete(progress) || getCurrentQuizAnswer(progress)) return progress;
  const question = MIL_QUIZ_QUESTIONS[progress.currentQuestionIndex];
  if (!question || !isQuizOptionId(question, optionId)) return progress;

  return {
    ...progress,
    answers: [...progress.answers, { questionId: question.id, optionId, answeredAt: timestamp }],
    updatedAt: timestamp,
  };
}

export function advanceQuiz(
  progress: QuizProgress,
  timestamp = new Date().toISOString(),
): QuizProgress {
  if (isQuizComplete(progress) || !getCurrentQuizAnswer(progress)) return progress;
  const lastIndex = MIL_QUIZ_QUESTIONS.length - 1;
  if (progress.currentQuestionIndex === lastIndex) {
    return { ...progress, updatedAt: timestamp, completedAt: timestamp };
  }

  return {
    ...progress,
    currentQuestionIndex: progress.currentQuestionIndex + 1,
    updatedAt: timestamp,
  };
}

export function restartQuiz(
  progress: QuizProgress,
  timestamp = new Date().toISOString(),
): QuizProgress {
  return {
    ...createEmptyQuizProgress(timestamp),
    createdAt: progress.createdAt,
  };
}

export function getAdjacentQuizOptionId(
  optionIds: readonly string[],
  currentOptionId: string,
  key: string,
): string | undefined {
  if (optionIds.length === 0) return undefined;
  if (key === 'Home') return optionIds[0];
  if (key === 'End') return optionIds[optionIds.length - 1];
  const currentIndex = optionIds.indexOf(currentOptionId);
  if (currentIndex < 0) return undefined;
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return optionIds[(currentIndex + 1) % optionIds.length];
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return optionIds[(currentIndex - 1 + optionIds.length) % optionIds.length];
  }
  return undefined;
}

export function serializeQuizProgress(progress: QuizProgress): string {
  return JSON.stringify({
    schemaVersion: QUIZ_SCHEMA_VERSION,
    contentVersion: MIL_QUIZ_CONTENT_VERSION,
    currentQuestionIndex: progress.currentQuestionIndex,
    answers: progress.answers.map(({ questionId, optionId, answeredAt }) => ({
      questionId,
      optionId,
      answeredAt,
    })),
    createdAt: progress.createdAt,
    updatedAt: progress.updatedAt,
    ...(progress.completedAt ? { completedAt: progress.completedAt } : {}),
  });
}

export function parseQuizProgress(
  raw: string | null,
  fallbackTimestamp = new Date().toISOString(),
): { progress: QuizProgress; status: QuizParseStatus } {
  if (!raw) return { progress: createEmptyQuizProgress(fallbackTimestamp), status: 'empty' };

  try {
    const value: unknown = JSON.parse(raw);
    const parsed = parseVersionOne(value);
    return parsed
      ? { progress: parsed, status: 'valid' }
      : { progress: createEmptyQuizProgress(fallbackTimestamp), status: 'recovered' };
  } catch {
    return { progress: createEmptyQuizProgress(fallbackTimestamp), status: 'recovered' };
  }
}

function parseVersionOne(value: unknown): QuizProgress | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== QUIZ_SCHEMA_VERSION) return undefined;
  if (value.contentVersion !== MIL_QUIZ_CONTENT_VERSION) return undefined;
  if (!Number.isInteger(value.currentQuestionIndex)) return undefined;
  if (typeof value.currentQuestionIndex !== 'number') return undefined;
  if (value.currentQuestionIndex < 0 || value.currentQuestionIndex >= MIL_QUIZ_QUESTIONS.length) return undefined;
  if (!Array.isArray(value.answers) || value.answers.length > MIL_QUIZ_QUESTIONS.length) return undefined;
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return undefined;
  if (value.completedAt !== undefined && !isTimestamp(value.completedAt)) return undefined;

  const answers: QuizAnswer[] = [];
  for (let index = 0; index < value.answers.length; index += 1) {
    const candidate = value.answers[index];
    const expectedQuestion = MIL_QUIZ_QUESTIONS[index];
    if (!isRecord(candidate) || !expectedQuestion) return undefined;
    if (candidate.questionId !== expectedQuestion.id) return undefined;
    if (typeof candidate.optionId !== 'string' || !isQuizOptionId(expectedQuestion, candidate.optionId)) return undefined;
    if (!isTimestamp(candidate.answeredAt)) return undefined;
    answers.push({
      questionId: expectedQuestion.id,
      optionId: candidate.optionId,
      answeredAt: candidate.answeredAt,
    });
  }

  const complete = typeof value.completedAt === 'string';
  if (complete && (answers.length !== MIL_QUIZ_QUESTIONS.length || value.currentQuestionIndex !== MIL_QUIZ_QUESTIONS.length - 1)) return undefined;
  if (!complete && answers.length < value.currentQuestionIndex) return undefined;
  if (!complete && answers.length > value.currentQuestionIndex + 1) return undefined;
  if (!complete && value.currentQuestionIndex > 0 && answers.length < value.currentQuestionIndex) return undefined;

  return {
    schemaVersion: QUIZ_SCHEMA_VERSION,
    contentVersion: MIL_QUIZ_CONTENT_VERSION,
    currentQuestionIndex: value.currentQuestionIndex,
    answers,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(complete ? { completedAt: value.completedAt as string } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
