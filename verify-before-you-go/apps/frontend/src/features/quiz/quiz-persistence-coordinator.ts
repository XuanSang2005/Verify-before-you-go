import type { QuizProgress } from './quiz-model';
import {
  readQuizProgress,
  saveQuizProgress,
  type QuizProgressReadResult,
} from './quiz-storage';
import {
  QuizProgressWriteQueue,
  type QuizWriteResult,
} from './quiz-write-queue';

type QuizProgressRead = () => Promise<QuizProgressReadResult>;
type QuizProgressWrite = (progress: QuizProgress) => Promise<void>;
type QuizWriteListener = (result: QuizWriteResult) => void;

export interface QuizPersistenceCoordinatorPort {
  enqueue: (progress: QuizProgress) => Promise<QuizWriteResult>;
  hydrate: (isActive?: () => boolean) => Promise<Omit<QuizProgressReadResult, 'requiresCanonicalWrite'>>;
  subscribe: (listener: QuizWriteListener) => () => void;
  whenIdle: () => Promise<void>;
}

export class QuizPersistenceCoordinator implements QuizPersistenceCoordinatorPort {
  private readonly writer: QuizProgressWriteQueue;

  constructor(
    private readonly read: QuizProgressRead = readQuizProgress,
    write: QuizProgressWrite = saveQuizProgress,
  ) {
    this.writer = new QuizProgressWriteQueue(write);
  }

  enqueue(progress: QuizProgress): Promise<QuizWriteResult> {
    return this.writer.enqueue(progress);
  }

  async hydrate(isActive?: () => boolean): Promise<Omit<QuizProgressReadResult, 'requiresCanonicalWrite'>> {
    await this.writer.whenIdle();
    if (isActive && !isActive()) throw new StaleQuizHydrationError();
    const loaded = await this.read();

    if (loaded.requiresCanonicalWrite && (!isActive || isActive())) {
      const result = await this.writer.enqueue(loaded.progress);
      if (result.status === 'failed') throw result.error;
    }

    return { progress: loaded.progress, status: loaded.status };
  }

  subscribe(listener: QuizWriteListener): () => void {
    return this.writer.subscribe(listener);
  }

  whenIdle(): Promise<void> {
    return this.writer.whenIdle();
  }
}

export const quizPersistenceCoordinator = new QuizPersistenceCoordinator();

class StaleQuizHydrationError extends Error {
  constructor() {
    super('Quiz hydration is no longer active.');
    this.name = 'StaleQuizHydrationError';
  }
}
