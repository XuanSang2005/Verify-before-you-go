import type { ReportDraft } from './report-model';
import {
  readReportDraft,
  saveReportDraft,
  type ReportDraftReadResult,
} from './report-storage';

export type ReportDraftWriteResult = {
  isLatest: boolean;
  revision: number;
} & (
  | { status: 'saved' }
  | { status: 'failed'; error: unknown }
);

type ReportDraftRead = () => Promise<ReportDraftReadResult>;
type ReportDraftWrite = (draft: ReportDraft) => Promise<void>;
type ReportDraftWriteListener = (result: ReportDraftWriteResult) => void;

export interface ReportDraftPersistencePort {
  enqueue: (draft: ReportDraft) => Promise<ReportDraftWriteResult>;
  hydrate: (isActive?: () => boolean) => Promise<Omit<ReportDraftReadResult, 'requiresCanonicalWrite'>>;
  subscribe: (listener: ReportDraftWriteListener) => () => void;
  whenIdle: () => Promise<void>;
}

export class ReportDraftPersistenceCoordinator implements ReportDraftPersistencePort {
  private latestRevision = 0;
  private listeners = new Set<ReportDraftWriteListener>();
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly read: ReportDraftRead = readReportDraft,
    private readonly write: ReportDraftWrite = saveReportDraft,
  ) {}

  enqueue(draft: ReportDraft): Promise<ReportDraftWriteResult> {
    const revision = this.latestRevision + 1;
    this.latestRevision = revision;
    const operation = this.tail.then(async (): Promise<ReportDraftWriteResult> => {
      try {
        await this.write(draft);
        return { isLatest: revision === this.latestRevision, revision, status: 'saved' };
      } catch (error) {
        return { error, isLatest: revision === this.latestRevision, revision, status: 'failed' };
      }
    });
    this.tail = operation.then((result) => {
      for (const listener of this.listeners) listener(result);
    });
    return operation;
  }

  async hydrate(isActive?: () => boolean): Promise<Omit<ReportDraftReadResult, 'requiresCanonicalWrite'>> {
    await this.whenIdle();
    if (isActive && !isActive()) throw new StaleReportDraftHydrationError();
    const loaded = await this.read();
    if (loaded.requiresCanonicalWrite && (!isActive || isActive())) {
      const result = await this.enqueue(loaded.draft);
      if (result.status === 'failed') throw result.error;
    }
    return { draft: loaded.draft, status: loaded.status };
  }

  subscribe(listener: ReportDraftWriteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async whenIdle(): Promise<void> {
    while (true) {
      const revision = this.latestRevision;
      const tail = this.tail;
      await tail;
      if (revision === this.latestRevision && tail === this.tail) return;
    }
  }
}

export const reportDraftPersistenceCoordinator = new ReportDraftPersistenceCoordinator();

class StaleReportDraftHydrationError extends Error {
  constructor() {
    super('Report draft hydration is no longer active.');
    this.name = 'StaleReportDraftHydrationError';
  }
}
