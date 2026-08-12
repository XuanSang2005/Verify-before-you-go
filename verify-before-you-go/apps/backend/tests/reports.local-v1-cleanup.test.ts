import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLocalV1CleanupEnvironment,
  AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS,
  deleteAuthorizedLocalSyntheticV1Reports,
  LOCAL_V1_REPORT_CLEANUP_CONFIRMATION,
  type LocalV1ReportCleanupCandidate,
} from '../src/modules/reports/reports.local-v1-cleanup.js';

function authorizedCandidates(): LocalV1ReportCleanupCandidate[] {
  return AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS.map((report) => ({
    publicId: report.publicId,
    submittedAt: new Date(report.submittedAt),
    status: 'RECEIVED',
    privateIdentifier: 'aes-gcm-v1$identifier',
    privateDescription: 'aes-gcm-v1$description',
    namedPartner: null,
    recoveryKeyDeliveryCiphertext: null,
    recoveryKeyDeliverUntil: null,
  }));
}

test('local cleanup requires explicit confirmation and a loopback development database', () => {
  assert.doesNotThrow(() => assertLocalV1CleanupEnvironment(
    'postgresql://postgres:postgres@localhost:5433/verify_before_you_go',
    'development',
    LOCAL_V1_REPORT_CLEANUP_CONFIRMATION,
  ));
  assert.throws(() => assertLocalV1CleanupEnvironment(
    'postgresql://postgres:postgres@db.internal/verify_before_you_go',
    'development',
    LOCAL_V1_REPORT_CLEANUP_CONFIRMATION,
  ), /restricted to the local/);
  assert.throws(() => assertLocalV1CleanupEnvironment(
    'postgresql://postgres:postgres@localhost:5433/verify_before_you_go',
    'production',
    LOCAL_V1_REPORT_CLEANUP_CONFIRMATION,
  ), /disabled in production/);
  assert.throws(() => assertLocalV1CleanupEnvironment(
    'postgresql://postgres:postgres@localhost:5433/verify_before_you_go',
    'development',
    'delete-all-reports',
  ), /exact confirmation token/);
});

test('guard deletes exactly the three fingerprinted synthetic v1 records', async () => {
  let deleteCalls = 0;
  const deleted = await deleteAuthorizedLocalSyntheticV1Reports({
    loadAuthorizedCandidates: async (ids) => {
      assert.deepEqual(ids, AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS.map((report) => report.publicId));
      return authorizedCandidates();
    },
    deleteAuthorizedCandidates: async () => {
      deleteCalls += 1;
      return 3;
    },
  });
  assert.equal(deleted, 3);
  assert.equal(deleteCalls, 1);
});

test('guard refuses missing, changed, v2 or overbroad candidates before deletion', async () => {
  const invalidSets = [
    authorizedCandidates().slice(0, 2),
    authorizedCandidates().map((candidate, index) => index === 1
      ? { ...candidate, privateIdentifier: 'aes-gcm-v2$do-not-delete' }
      : candidate),
    [...authorizedCandidates(), { ...authorizedCandidates()[0]!, publicId: 'R-2222222222222222' }],
  ];
  for (const candidates of invalidSets) {
    let deleteCalls = 0;
    await assert.rejects(deleteAuthorizedLocalSyntheticV1Reports({
      loadAuthorizedCandidates: async () => candidates,
      deleteAuthorizedCandidates: async () => {
        deleteCalls += 1;
        return 3;
      },
    }));
    assert.equal(deleteCalls, 0);
  }
});

test('transaction must report exactly three deletions or fail closed', async () => {
  await assert.rejects(deleteAuthorizedLocalSyntheticV1Reports({
    loadAuthorizedCandidates: async () => authorizedCandidates(),
    deleteAuthorizedCandidates: async () => 2,
  }), /did not delete exactly three/);
});
