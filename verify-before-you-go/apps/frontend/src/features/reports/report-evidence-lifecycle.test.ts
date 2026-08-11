import assert from 'node:assert/strict';
import test from 'node:test';

import { runEvidenceTransaction } from './indexeddb-evidence-transaction';
import {
  ReportEvidenceLifecycleCoordinator,
} from './report-evidence-lifecycle';
import {
  createEmptyReportEvidenceLifecycleJournal,
  LocalReportEvidenceLifecycleJournal,
  REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY,
  type ReportEvidenceLifecycleJournal,
  type ReportEvidenceLifecycleJournalPort,
  type ReportEvidenceLifecycleKeyValuePort,
} from './report-evidence-lifecycle-storage';
import type { ReportDraftPersistencePort, ReportDraftWriteResult } from './report-persistence-coordinator';
import type { LocalReportEvidenceStoragePort } from './report-evidence-storage-port';
import { createEmptyReportDraft, parseReportDraft, updateReportDraft, type ReportDraft, type ReportEvidenceDraft } from './report-model';

const timestamp = '2026-08-11T08:00:00.000Z';
const evidence: ReportEvidenceDraft = {
  addedAt: timestamp,
  fileName: 'evidence.png',
  fileSize: 100,
  id: 'evidence-1',
  mimeType: 'image/png',
  uri: 'file:///picked/evidence.png',
};

class MemoryEvidenceStorage implements LocalReportEvidenceStoragePort {
  entries = new Map<string, ReportEvidenceDraft>();
  failRemove = false;

  async persist(value: ReportEvidenceDraft) {
    const stored = { ...value, uri: `vbyg-private-evidence://${value.id}` };
    this.entries.set(value.id, stored);
    return stored;
  }

  async remove(evidenceId: string) {
    if (this.failRemove) throw new Error('delete failed');
    this.entries.delete(evidenceId);
  }

  async listEvidenceIds() {
    return [...this.entries.keys()];
  }
}

class MemoryJournal implements ReportEvidenceLifecycleJournalPort {
  journal = createEmptyReportEvidenceLifecycleJournal(timestamp);
  history: ReportEvidenceLifecycleJournal[] = [];
  recovered = false;

  async read() {
    return { journal: structuredClone(this.journal), recovered: this.recovered };
  }

  async write(journal: ReportEvidenceLifecycleJournal) {
    this.journal = structuredClone(journal);
    this.history.push(structuredClone(journal));
    this.recovered = false;
  }
}

test('successful add persists evidence, saves its draft reference, marks committed and clears the journal', async () => {
  const files = new MemoryEvidenceStorage();
  const journal = new MemoryJournal();
  const savedDrafts: ReportDraft[] = [];
  const coordinator = new ReportEvidenceLifecycleCoordinator(
    persistence(async (draft) => {
      savedDrafts.push(draft);
      return { isLatest: true, revision: 1, status: 'saved' };
    }),
    files,
    journal,
    () => timestamp,
  );

  const result = await coordinator.add(createEmptyReportDraft(timestamp), evidence);
  assert.equal(result.draft.evidence[0]?.id, evidence.id);
  assert.equal(savedDrafts[0]?.evidence[0]?.id, evidence.id);
  assert.deepEqual(journal.history.flatMap((entry) => entry.operations.map((operation) => operation.stage)), [
    'preparing',
    'evidence-written',
    'committed',
  ]);
  assert.deepEqual(journal.journal.operations, []);
});

function persistence(
  write: (draft: ReportDraft) => Promise<ReportDraftWriteResult> = async () => ({ isLatest: true, revision: 1, status: 'saved' }),
): ReportDraftPersistencePort {
  return {
    enqueue: write,
    hydrate: async () => ({ draft: createEmptyReportDraft(timestamp), status: 'empty' }),
    subscribe: () => () => undefined,
    whenIdle: async () => undefined,
  };
}

function draftWithEvidence(item = evidence): ReportDraft {
  return updateReportDraft(createEmptyReportDraft(timestamp), { evidence: [item] }, timestamp);
}

test('add cleans stored evidence when draft metadata persistence fails', async () => {
  const files = new MemoryEvidenceStorage();
  const journal = new MemoryJournal();
  const coordinator = new ReportEvidenceLifecycleCoordinator(
    persistence(async () => ({ error: new Error('metadata failed'), isLatest: true, revision: 1, status: 'failed' })),
    files,
    journal,
    () => timestamp,
  );

  await assert.rejects(() => coordinator.add(createEmptyReportDraft(timestamp), evidence), /metadata failed/u);
  assert.deepEqual(await files.listEvidenceIds(), []);
  assert.deepEqual(journal.journal.operations, []);
});

test('failed add cleanup leaves a recoverable journal operation', async () => {
  const files = new MemoryEvidenceStorage();
  files.failRemove = true;
  const journal = new MemoryJournal();
  const coordinator = new ReportEvidenceLifecycleCoordinator(
    persistence(async () => ({ error: new Error('metadata failed'), isLatest: true, revision: 1, status: 'failed' })),
    files,
    journal,
    () => timestamp,
  );

  await assert.rejects(() => coordinator.add(createEmptyReportDraft(timestamp), evidence), /metadata failed/u);
  assert.deepEqual(await files.listEvidenceIds(), ['evidence-1']);
  assert.equal(journal.journal.operations[0]?.kind, 'add');
});

test('remove persists metadata before deletion and never deletes when metadata save fails', async () => {
  const files = new MemoryEvidenceStorage();
  files.entries.set(evidence.id, evidence);
  const journal = new MemoryJournal();
  let removeCalls = 0;
  const originalRemove = files.remove.bind(files);
  files.remove = async (id) => { removeCalls += 1; await originalRemove(id); };
  const coordinator = new ReportEvidenceLifecycleCoordinator(
    persistence(async () => ({ error: new Error('metadata failed'), isLatest: true, revision: 1, status: 'failed' })),
    files,
    journal,
    () => timestamp,
  );

  await assert.rejects(() => coordinator.remove(draftWithEvidence(), evidence.id), /metadata failed/u);
  assert.equal(removeCalls, 0);
  assert.deepEqual(await files.listEvidenceIds(), ['evidence-1']);
  assert.deepEqual(journal.journal.operations, []);
});

test('delete failure after metadata removal leaves a tombstone and no draft reference', async () => {
  const files = new MemoryEvidenceStorage();
  files.entries.set(evidence.id, evidence);
  files.failRemove = true;
  const journal = new MemoryJournal();
  const savedDrafts: ReportDraft[] = [];
  const coordinator = new ReportEvidenceLifecycleCoordinator(
    persistence(async (draft) => {
      savedDrafts.push(draft);
      return { isLatest: true, revision: 1, status: 'saved' };
    }),
    files,
    journal,
    () => timestamp,
  );

  const result = await coordinator.remove(draftWithEvidence(), evidence.id);
  assert.equal(result.draft.evidence.length, 0);
  assert.equal(savedDrafts[0]?.evidence.length, 0);
  assert.equal(journal.journal.operations[0]?.kind, 'remove');
  assert.equal(journal.journal.operations[0]?.stage, 'metadata-removed');
});

test('fresh coordinator recovers app closure during add and removes the orphan', async () => {
  const files = new MemoryEvidenceStorage();
  files.entries.set(evidence.id, evidence);
  const journal = new MemoryJournal();
  journal.journal.operations = [{ evidenceId: evidence.id, kind: 'add', stage: 'evidence-written', updatedAt: timestamp }];

  const restarted = new ReportEvidenceLifecycleCoordinator(persistence(), files, journal, () => timestamp);
  const result = await restarted.reconcile(createEmptyReportDraft(timestamp));
  assert.equal(result.draft.evidence.length, 0);
  assert.deepEqual(await files.listEvidenceIds(), []);
  assert.deepEqual(journal.journal.operations, []);
});

test('fresh coordinator recovers app closure during remove without restoring a draft reference', async () => {
  const files = new MemoryEvidenceStorage();
  files.entries.set(evidence.id, evidence);
  const journal = new MemoryJournal();
  journal.journal.operations = [{ evidenceId: evidence.id, kind: 'remove', stage: 'metadata-removed', updatedAt: timestamp }];

  const restarted = new ReportEvidenceLifecycleCoordinator(persistence(), files, journal, () => timestamp);
  const result = await restarted.reconcile(createEmptyReportDraft(timestamp));
  assert.equal(result.draft.evidence.length, 0);
  assert.deepEqual(await files.listEvidenceIds(), []);
  assert.deepEqual(journal.journal.operations, []);
});

test('reconciliation removes dangling draft references and orphan files after corrupt draft recovery', async () => {
  const files = new MemoryEvidenceStorage();
  files.entries.set('evidence-orphan', { ...evidence, id: 'evidence-orphan' });
  const journal = new MemoryJournal();
  journal.recovered = true;
  const writes: ReportDraft[] = [];
  const coordinator = new ReportEvidenceLifecycleCoordinator(
    persistence(async (draft) => {
      writes.push(draft);
      return { isLatest: true, revision: 1, status: 'saved' };
    }),
    files,
    journal,
    () => timestamp,
  );
  const corruptRecovery = parseReportDraft('{broken', timestamp);
  assert.equal(corruptRecovery.status, 'recovered');

  const result = await coordinator.reconcile(corruptRecovery.draft);
  assert.deepEqual(await files.listEvidenceIds(), []);
  assert.equal(result.recoveryNotice?.includes('reconciled'), true);

  const dangling = draftWithEvidence();
  const repaired = await coordinator.reconcile(dangling);
  assert.equal(repaired.draft.evidence.length, 0);
  assert.equal(writes.at(-1)?.evidence.length, 0);
});

test('future draft recovery also reconciles orphan evidence', async () => {
  const files = new MemoryEvidenceStorage();
  files.entries.set('evidence-future-orphan', { ...evidence, id: 'evidence-future-orphan' });
  const journal = new MemoryJournal();
  const coordinator = new ReportEvidenceLifecycleCoordinator(persistence(), files, journal, () => timestamp);
  const futureRecovery = parseReportDraft(JSON.stringify({
    ...createEmptyReportDraft(timestamp),
    schemaVersion: 99,
  }), timestamp);
  assert.equal(futureRecovery.status, 'recovered');

  await coordinator.reconcile(futureRecovery.draft);
  assert.deepEqual(await files.listEvidenceIds(), []);
});

test('future and corrupt lifecycle journals are version-guarded', async () => {
  const values = new Map<string, string>();
  const keyValue: ReportEvidenceLifecycleKeyValuePort = {
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
  const storage = new LocalReportEvidenceLifecycleJournal(keyValue, () => timestamp);
  values.set(REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, operations: [], updatedAt: timestamp }));
  assert.equal((await storage.read()).recovered, true);
  values.set(REPORT_EVIDENCE_LIFECYCLE_STORAGE_KEY, '{broken');
  assert.equal((await storage.read()).recovered, true);
});

test('IndexedDB evidence transaction waits for completion and rejects aborts', async () => {
  let transactionComplete: (() => void) | null = null;
  let requestSuccess: (() => void) | null = null;
  const request = { result: 'stored' } as unknown as IDBRequest<string>;
  const transaction = {
    abort: () => undefined,
    error: null,
    objectStore: () => ({ put: () => request }),
  } as unknown as IDBTransaction;
  const database = { transaction: () => transaction } as unknown as IDBDatabase;
  const pending = runEvidenceTransaction(database, 'readwrite', (store) => store.put('value', 'evidence-1') as IDBRequest<string>);
  requestSuccess = request.onsuccess as unknown as () => void;
  transactionComplete = transaction.oncomplete as unknown as () => void;
  let settled = false;
  void pending.then(() => { settled = true; });
  requestSuccess();
  await Promise.resolve();
  assert.equal(settled, false);
  transactionComplete();
  assert.equal(await pending, 'stored');

  const abortRequest = {} as IDBRequest<void>;
  const abortTransaction = {
    abort: () => undefined,
    error: null,
    objectStore: () => ({ delete: () => abortRequest }),
  } as unknown as IDBTransaction;
  const abortDatabase = { transaction: () => abortTransaction } as unknown as IDBDatabase;
  const aborted = runEvidenceTransaction(abortDatabase, 'readwrite', (store) => store.delete('evidence-1'));
  (abortTransaction.onabort as unknown as () => void)();
  await assert.rejects(aborted, /aborted/u);
});
