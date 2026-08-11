import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseQuizProgress,
  serializeQuizProgress,
  type QuizParseStatus,
  type QuizProgress,
} from './quiz-model';

export const QUIZ_STORAGE_KEY = '@vbyg/mil-quiz/v1';

export interface QuizStoragePort {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

const asyncStoragePort: QuizStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

export interface QuizProgressReadResult {
  progress: QuizProgress;
  requiresCanonicalWrite: boolean;
  status: QuizParseStatus;
}

export async function readQuizProgress(
  storage: QuizStoragePort = asyncStoragePort,
  fallbackTimestamp?: string,
): Promise<QuizProgressReadResult> {
  const raw = await storage.getItem(QUIZ_STORAGE_KEY);
  const result = parseQuizProgress(raw, fallbackTimestamp);
  const canonical = serializeQuizProgress(result.progress);
  return {
    ...result,
    requiresCanonicalWrite: result.status === 'recovered' || (raw !== null && raw !== canonical),
  };
}

export async function loadQuizProgress(
  storage: QuizStoragePort = asyncStoragePort,
  fallbackTimestamp?: string,
): Promise<{ progress: QuizProgress; status: QuizParseStatus }> {
  const result = await readQuizProgress(storage, fallbackTimestamp);

  if (result.requiresCanonicalWrite) {
    await saveQuizProgress(result.progress, storage);
  }
  return { progress: result.progress, status: result.status };
}

export async function saveQuizProgress(
  progress: QuizProgress,
  storage: QuizStoragePort = asyncStoragePort,
): Promise<void> {
  await storage.setItem(QUIZ_STORAGE_KEY, serializeQuizProgress(progress));
}
