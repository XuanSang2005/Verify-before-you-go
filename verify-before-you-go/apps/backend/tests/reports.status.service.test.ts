import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ReportsRepository,
  RecruitmentReportStatusRecord,
} from '../src/modules/reports/reports.repository.js';
import {
  ReportStatusUnavailableError,
  lookupRecruitmentReportStatus,
} from '../src/modules/reports/reports.service.js';
import { hashRecoveryKey, verifyRecoveryKey } from '../src/modules/reports/reports.security.js';

const reportId = 'R-23456789ABCDEFGH';
const recoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-ST';
const wrongRecoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-SU';

function createStatusRepository(record: RecruitmentReportStatusRecord | null): ReportsRepository {
  return {
    findByIdempotencyHash: async () => null,
    findStatusByPublicId: async (requestedId) => requestedId === record?.publicId ? record : null,
    create: async () => { throw new Error('not used'); },
    clearRecoveryKeyDelivery: async () => undefined,
    clearExpiredRecoveryKeyDeliveries: async () => 0,
  };
}

test('scrypt recovery verification accepts only the matching key and canonical stored hash', async () => {
  const hash = await hashRecoveryKey(recoveryKey, Buffer.alloc(16, 7));
  assert.equal(await verifyRecoveryKey(recoveryKey, hash), true);
  assert.equal(await verifyRecoveryKey(wrongRecoveryKey, hash), false);
  assert.equal(await verifyRecoveryKey(recoveryKey, `${hash}=`), false);
  assert.equal(await verifyRecoveryKey(recoveryKey, 'scrypt-v1$bad$hash'), false);
});

test('status lookup supports the three recoverable states with only privacy-safe response fields', async () => {
  const recoveryKeyHash = await hashRecoveryKey(recoveryKey, Buffer.alloc(16, 8));
  const cases = [
    ['RECEIVED', 'received'],
    ['UNDER_REVIEW', 'under-review'],
    ['MORE_EVIDENCE_NEEDED', 'more-evidence-needed'],
  ] as const;

  for (const [storedStatus, expectedStatus] of cases) {
    const result = await lookupRecruitmentReportStatus(createStatusRepository({
      publicId: reportId,
      recoveryKeyHash,
      status: storedStatus,
      submittedAt: new Date('2026-08-11T10:00:00.000Z'),
      updatedAt: new Date('2026-08-12T11:30:00.000Z'),
    }), { reportId, recoveryKey });

    assert.equal(result.status, expectedStatus);
    assert.deepEqual(Object.keys(result).sort(), [
      'nextStep',
      'reportId',
      'status',
      'submittedAt',
      'updatedAt',
    ]);
    assert.match(result.nextStep, /does not mean|not a scam verdict/iu);
    assert.equal(JSON.stringify(result).includes(recoveryKey), false);
  }
});

test('wrong recovery key and unknown report fail with the same generic service error', async () => {
  const recoveryKeyHash = await hashRecoveryKey(recoveryKey, Buffer.alloc(16, 9));
  const repository = createStatusRepository({
    publicId: reportId,
    recoveryKeyHash,
    status: 'RECEIVED',
    submittedAt: new Date('2026-08-11T10:00:00.000Z'),
    updatedAt: new Date('2026-08-11T10:00:00.000Z'),
  });

  for (const request of [
    { reportId, recoveryKey: wrongRecoveryKey },
    { reportId: 'R-23456789ABCDEFGJ', recoveryKey },
  ]) {
    await assert.rejects(
      lookupRecruitmentReportStatus(repository, request),
      (error: unknown) => error instanceof ReportStatusUnavailableError
        && error.message === 'The report status could not be retrieved with those details.',
    );
  }
});

test('a matching key cannot expose unsupported terminal report states through CP13', async () => {
  const recoveryKeyHash = await hashRecoveryKey(recoveryKey, Buffer.alloc(16, 10));
  await assert.rejects(
    lookupRecruitmentReportStatus(createStatusRepository({
      publicId: reportId,
      recoveryKeyHash,
      status: 'CLOSED',
      submittedAt: new Date('2026-08-11T10:00:00.000Z'),
      updatedAt: new Date('2026-08-12T11:30:00.000Z'),
    }), { reportId, recoveryKey }),
    ReportStatusUnavailableError,
  );
});
