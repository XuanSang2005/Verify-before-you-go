import type { QuizProgress } from './quiz-model';

export type QuizWriteResult = {
  revision: number;
  isLatest: boolean;
} & (
  | { status: 'saved' }
  | { status: 'failed'; error: unknown }
);

type QuizProgressWrite = (progress: QuizProgress) => Promise<void>;
type QuizWriteListener = (result: QuizWriteResult) => void;

export class QuizProgressWriteQueue {
  private latestRevision = 0;
  private tail: Promise<void> = Promise.resolve();
  private listeners = new Set<QuizWriteListener>();

  constructor(private readonly write: QuizProgressWrite) {}

  subscribe(listener: QuizWriteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueue(progress: QuizProgress): Promise<QuizWriteResult> {
    const revision = this.latestRevision + 1;
    this.latestRevision = revision;

    const operation = this.tail.then(async (): Promise<QuizWriteResult> => {
      try {
        await this.write(progress);
        return {
          revision,
          isLatest: revision === this.latestRevision,
          status: 'saved',
        };
      } catch (error) {
        return {
          revision,
          isLatest: revision === this.latestRevision,
          status: 'failed',
          error,
        };
      }
    });

    this.tail = operation.then((result) => {
      for (const listener of this.listeners) listener(result);
    });
    return operation;
  }

  async whenIdle(): Promise<void> {
    while (true) {
      const observedRevision = this.latestRevision;
      const observedTail = this.tail;
      await observedTail;
      if (observedRevision === this.latestRevision && observedTail === this.tail) return;
    }
  }
}

export function enqueueQuizWriteAfterConfirmedRead(
  progress: QuizProgress,
  storageReadSucceeded: boolean,
  writer: Pick<QuizProgressWriteQueue, 'enqueue'>,
): Promise<QuizWriteResult> | 'deferred' {
  if (!storageReadSucceeded) return 'deferred';
  return writer.enqueue(progress);
}
