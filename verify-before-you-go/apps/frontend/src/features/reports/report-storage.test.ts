import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyReportDraft, parseReportDraft, toggleReportBehaviour, updateReportDraft } from './report-model';
import { ReportDraftPersistenceCoordinator } from './report-persistence-coordinator';
import {
  readReportDraft,
  REPORT_DRAFT_STORAGE_KEY,
  saveReportDraft,
  type ReportDraftStoragePort,
} from './report-storage';

class MemoryReportStorage implements ReportDraftStoragePort {
  raw: string | null = null;
  reads = 0;
  writes = 0;

  async getItem(key: string) {
    assert.equal(key, REPORT_DRAFT_STORAGE_KEY);
    this.reads += 1;
    return this.raw;
  }

  async setItem(key: string, value: string) {
    assert.equal(key, REPORT_DRAFT_STORAGE_KEY);
    this.writes += 1;
    this.raw = value;
  }
}

test('draft persists through the local storage abstraction and hydrates after remount', async () => {
  const storage = new MemoryReportStorage();
  const draft = updateReportDraft(
    toggleReportBehaviour(createEmptyReportDraft('2026-08-11T08:00:00.000Z'), 'identity-document-request'),
    { identifierType: 'handle', identifier: '@demo_recruiter' },
    '2026-08-11T08:01:00.000Z',
  );
  await saveReportDraft(draft, storage);
  const remounted = await readReportDraft(storage);
  assert.equal(remounted.status, 'valid');
  assert.deepEqual(remounted.draft, draft);
});

test('corrupt storage is replaced only after a successful read and version recovery', async () => {
  const storage = new MemoryReportStorage();
  storage.raw = '{broken';
  const coordinator = new ReportDraftPersistenceCoordinator(
    () => readReportDraft(storage, '2026-08-11T08:00:00.000Z'),
    (draft) => saveReportDraft(draft, storage),
  );
  const loaded = await coordinator.hydrate();
  await coordinator.whenIdle();
  assert.equal(loaded.status, 'recovered');
  assert.equal(storage.writes, 1);
  assert.equal(parseReportDraft(storage.raw).status, 'valid');
});

test('coordinator serializes writes and a later draft remains authoritative', async () => {
  const writes: string[] = [];
  let releaseFirst!: () => void;
  const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let call = 0;
  const coordinator = new ReportDraftPersistenceCoordinator(
    async () => ({ draft: createEmptyReportDraft(), requiresCanonicalWrite: false, status: 'empty' }),
    async (draft) => {
      call += 1;
      if (call === 1) await firstBlocked;
      writes.push(draft.identifier);
    },
  );
  const empty = createEmptyReportDraft('2026-08-11T08:00:00.000Z');
  const first = coordinator.enqueue(updateReportDraft(empty, { identifier: 'first.example' }));
  const latest = coordinator.enqueue(updateReportDraft(empty, { identifier: 'latest.example' }));
  releaseFirst();
  assert.equal((await first).isLatest, false);
  assert.equal((await latest).isLatest, true);
  assert.deepEqual(writes, ['first.example', 'latest.example']);
});

test('saved draft contains no account or reporter identity field', async () => {
  const storage = new MemoryReportStorage();
  await saveReportDraft(createEmptyReportDraft('2026-08-11T08:00:00.000Z'), storage);
  assert.doesNotMatch(storage.raw || '', /reporter(Name|Email|Phone)|accountId|userId/iu);
});
