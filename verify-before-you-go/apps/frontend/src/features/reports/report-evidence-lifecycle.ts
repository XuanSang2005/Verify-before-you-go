import {
  REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION,
  type ReportEvidenceLifecycleJournal,
  type ReportEvidenceLifecycleJournalPort,
  type ReportEvidenceLifecycleOperation,
} from './report-evidence-lifecycle-storage';
import {
  type ReportDraftPersistencePort,
} from './report-persistence-coordinator';
import type { LocalReportEvidenceStoragePort } from './report-evidence-storage-port';
import { updateReportDraft, type ReportDraft, type ReportEvidenceDraft } from './report-model';

export interface ReportEvidenceLifecycleResult {
  draft: ReportDraft;
  recoveryNotice?: string;
  storageWarning?: string;
}

export interface ReportEvidenceLifecyclePort {
  add: (draft: ReportDraft, evidence: ReportEvidenceDraft) => Promise<ReportEvidenceLifecycleResult>;
  remove: (draft: ReportDraft, evidenceId: string) => Promise<ReportEvidenceLifecycleResult>;
  reconcile: (draft: ReportDraft) => Promise<ReportEvidenceLifecycleResult>;
  whenIdle: () => Promise<void>;
}

export class ReportEvidenceLifecycleCoordinator implements ReportEvidenceLifecyclePort {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly draftPersistence: ReportDraftPersistencePort,
    private readonly evidenceStorage: LocalReportEvidenceStoragePort,
    private readonly journalStorage: ReportEvidenceLifecycleJournalPort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  add(draft: ReportDraft, evidence: ReportEvidenceDraft): Promise<ReportEvidenceLifecycleResult> {
    return this.enqueue(async () => {
      await this.upsertOperation({ evidenceId: evidence.id, kind: 'add', stage: 'preparing', updatedAt: this.now() });
      let persistedEvidence: ReportEvidenceDraft | undefined;
      try {
        persistedEvidence = await this.evidenceStorage.persist(evidence);
        await this.upsertOperation({ evidenceId: evidence.id, kind: 'add', stage: 'evidence-written', updatedAt: this.now() });
        const next = updateReportDraft(draft, { evidence: [...draft.evidence, persistedEvidence] }, this.now());
        const write = await this.draftPersistence.enqueue(next);
        if (write.status === 'failed') throw write.error;
        const committed = await this.upsertOperation({
          evidenceId: evidence.id,
          kind: 'add',
          stage: 'committed',
          updatedAt: this.now(),
        }).then(() => true, () => false);
        const journalCleared = committed
          ? await this.removeOperation(evidence.id).then(() => true, () => false)
          : false;
        return {
          draft: next,
          storageWarning: journalCleared
            ? undefined
            : 'The evidence was saved, but local recovery housekeeping is still pending.',
        };
      } catch (error) {
        if (persistedEvidence) {
          const cleaned = await this.evidenceStorage.remove(evidence.id).then(() => true, () => false);
          if (cleaned) await this.removeOperation(evidence.id).catch(() => undefined);
        } else {
          await this.removeOperation(evidence.id).catch(() => undefined);
        }
        throw error;
      }
    });
  }

  remove(draft: ReportDraft, evidenceId: string): Promise<ReportEvidenceLifecycleResult> {
    return this.enqueue(async () => {
      if (!draft.evidence.some((item) => item.id === evidenceId)) return { draft };
      await this.upsertOperation({ evidenceId, kind: 'remove', stage: 'preparing', updatedAt: this.now() });
      const next = updateReportDraft(draft, {
        evidence: draft.evidence.filter((item) => item.id !== evidenceId),
      }, this.now());
      const write = await this.draftPersistence.enqueue(next);
      if (write.status === 'failed') {
        await this.removeOperation(evidenceId).catch(() => undefined);
        throw write.error;
      }

      await this.upsertOperation({ evidenceId, kind: 'remove', stage: 'metadata-removed', updatedAt: this.now() })
        .catch(() => undefined);
      try {
        await this.evidenceStorage.remove(evidenceId);
        await this.removeOperation(evidenceId).catch(() => undefined);
        return { draft: next };
      } catch {
        return {
          draft: next,
          storageWarning: 'The draft no longer references this image. Private file cleanup will retry on this device.',
        };
      }
    });
  }

  reconcile(draft: ReportDraft): Promise<ReportEvidenceLifecycleResult> {
    return this.enqueue(async () => {
      const { journal: loadedJournal, recovered } = await this.journalStorage.read();
      let operations = [...loadedJournal.operations];
      const storedIds = new Set(await this.evidenceStorage.listEvidenceIds());
      const referencedIds = new Set(draft.evidence.map((item) => item.id));
      const cleanupFailures = new Set<string>();

      for (const operation of operations) {
        if (operation.kind === 'add') {
          if (referencedIds.has(operation.evidenceId) && storedIds.has(operation.evidenceId)) continue;
          if (!referencedIds.has(operation.evidenceId) && storedIds.has(operation.evidenceId)) {
            const removed = await this.removeStoredEvidence(operation.evidenceId);
            if (removed) storedIds.delete(operation.evidenceId);
            else cleanupFailures.add(operation.evidenceId);
          }
          continue;
        }

        if (referencedIds.has(operation.evidenceId)) continue;
        if (storedIds.has(operation.evidenceId)) {
          const removed = await this.removeStoredEvidence(operation.evidenceId);
          if (removed) storedIds.delete(operation.evidenceId);
          else cleanupFailures.add(operation.evidenceId);
        }
      }

      for (const storedId of [...storedIds]) {
        if (referencedIds.has(storedId)) continue;
        const removed = await this.removeStoredEvidence(storedId);
        if (removed) storedIds.delete(storedId);
        else cleanupFailures.add(storedId);
      }

      const repairedEvidence = draft.evidence.filter((item) => storedIds.has(item.id));
      let reconciledDraft = draft;
      if (repairedEvidence.length !== draft.evidence.length) {
        reconciledDraft = updateReportDraft(draft, { evidence: repairedEvidence }, this.now());
        const write = await this.draftPersistence.enqueue(reconciledDraft);
        if (write.status === 'failed') throw write.error;
      }

      operations = [...cleanupFailures].map((evidenceId): ReportEvidenceLifecycleOperation => ({
        evidenceId,
        kind: 'remove',
        stage: 'metadata-removed',
        updatedAt: this.now(),
      }));
      await this.journalStorage.write({
        schemaVersion: REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION,
        operations,
        updatedAt: this.now(),
      });

      const changed = recovered
        || repairedEvidence.length !== draft.evidence.length
        || loadedJournal.operations.length > 0
        || storedIds.size !== referencedIds.size;
      return {
        draft: reconciledDraft,
        recoveryNotice: changed ? 'Private evidence storage was checked and safely reconciled on this device.' : undefined,
        storageWarning: cleanupFailures.size
          ? 'Some unreferenced private files could not be removed yet. Cleanup will retry.'
          : undefined,
      };
    });
  }

  async whenIdle(): Promise<void> {
    while (true) {
      const tail = this.tail;
      await tail;
      if (tail === this.tail) return;
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private async removeStoredEvidence(evidenceId: string): Promise<boolean> {
    try {
      await this.evidenceStorage.remove(evidenceId);
      return true;
    } catch {
      return false;
    }
  }

  private async upsertOperation(operation: ReportEvidenceLifecycleOperation): Promise<void> {
    const { journal } = await this.journalStorage.read();
    await this.writeOperations(journal, [
      ...journal.operations.filter((item) => item.evidenceId !== operation.evidenceId),
      operation,
    ]);
  }

  private async removeOperation(evidenceId: string): Promise<void> {
    const { journal } = await this.journalStorage.read();
    await this.writeOperations(journal, journal.operations.filter((item) => item.evidenceId !== evidenceId));
  }

  private writeOperations(
    journal: ReportEvidenceLifecycleJournal,
    operations: ReportEvidenceLifecycleOperation[],
  ): Promise<void> {
    return this.journalStorage.write({
      ...journal,
      schemaVersion: REPORT_EVIDENCE_LIFECYCLE_SCHEMA_VERSION,
      operations,
      updatedAt: this.now(),
    });
  }
}
