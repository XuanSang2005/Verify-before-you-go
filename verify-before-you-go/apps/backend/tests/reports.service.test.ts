import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReportSubmissionRequest } from '@vbyg/contracts';

import {
  type CreateRecruitmentReportInput,
  type RecruitmentReportRecord,
  type ReportsRepository,
} from '../src/modules/reports/reports.repository.js';
import {
  containsPotentialDirectIdentifierOnServer,
  normalizeSensitiveReportText,
  redactSensitiveReportTextOnServer,
} from '../src/modules/reports/reports.redaction.js';
import {
  RECOVERY_KEY_DELIVERY_WINDOW_MS,
  ReportIdempotencyConflictError,
  submitRecruitmentReport,
} from '../src/modules/reports/reports.service.js';
import {
  createRandomRecoveryKey,
  decryptPrivateReportText,
  deriveReportSecurityKeys,
  encryptPrivateReportText,
} from '../src/modules/reports/reports.security.js';

const securitySecret = 'dW5pdC10ZXN0LXJlcG9ydC1zZWN1cml0eS1zZWNyZXQtMzItYnl0ZXM';
const idempotencyKey = 'abcdefghijklmnopqrstuvwx';
const fixedRecoveryKey = '2345-6789-ABCD-EFGH-JKLM-NPQR-ST';
const request: ReportSubmissionRequest = {
  subjectType: 'recruiter',
  identifierType: 'handle',
  identifier: '@private_recruiter',
  behaviourIds: ['identity-document-request', 'pressure'],
  description: 'Contact @private_recruiter or person@example.org. Passport no. AB1234567.',
  redactedPreview: 'Contact @private_recruiter and person@example.org.',
  permissions: {
    useForPrivateMatching: true,
    allowRedactedPublicAlert: false,
    shareWithNamedPartner: false,
    namedPartner: '',
  },
};

function createMemoryRepository(): ReportsRepository & {
  cleared: string[];
  created: CreateRecruitmentReportInput[];
} {
  const records = new Map<string, RecruitmentReportRecord>();
  const created: CreateRecruitmentReportInput[] = [];
  const cleared: string[] = [];
  return {
    cleared,
    created,
    async findByIdempotencyHash(hash) {
      return records.get(hash) ?? null;
    },
    async findStatusByPublicId() {
      return null;
    },
    async create(input) {
      created.push(input);
      const record = toRecord(input);
      records.set(input.idempotencyKeyHash, record);
      return record;
    },
    async clearRecoveryKeyDelivery(publicId) {
      cleared.push(publicId);
      for (const [hash, record] of records) {
        if (record.publicId === publicId) {
          records.set(hash, {
            ...record,
            recoveryKeyDeliveryCiphertext: null,
            recoveryKeyDeliverUntil: null,
          });
        }
      }
    },
    async clearExpiredRecoveryKeyDeliveries() {
      return 0;
    },
  };
}

function toRecord(input: CreateRecruitmentReportInput): RecruitmentReportRecord {
  return {
    publicId: input.publicId,
    idempotencyKeyHash: input.idempotencyKeyHash,
    submissionPayloadHash: input.submissionPayloadHash,
    submittedAt: input.submittedAt,
    recoveryKeyDeliveryCiphertext: input.recoveryKeyDeliveryCiphertext,
    recoveryKeyDeliverUntil: input.recoveryKeyDeliverUntil,
  };
}

const deterministicDependencies = {
  createPublicId: () => 'R-23456789ABCDEFGH',
  createRecoveryKey: () => fixedRecoveryKey,
  hashRecoverySecret: async () => 'scrypt-v1$stored-salt$stored-hash',
  now: () => new Date('2026-08-11T10:00:00.000Z'),
};

test('report submission encrypts private data, stores only the recovery hash and omits public derivatives without consent', async () => {
  const repository = createMemoryRepository();
  const result = await submitRecruitmentReport(repository, request, idempotencyKey, securitySecret, deterministicDependencies);

  assert.equal(repository.created.length, 1);
  const stored = repository.created[0];
  assert.ok(stored);
  assert.equal(stored.recoveryKeyHash, 'scrypt-v1$stored-salt$stored-hash');
  assert.notEqual(stored.recoveryKeyHash, result.recoveryKey);
  assert.match(stored.privateIdentifier, /^aes-gcm-v2\$/u);
  assert.match(stored.privateDescription, /^aes-gcm-v2\$/u);
  assert.doesNotMatch(stored.privateIdentifier, /private_recruiter/iu);
  assert.doesNotMatch(stored.privateDescription, /person@example\.org|AB1234567/iu);
  assert.equal(stored.publicRedactedIdentifier, null);
  assert.equal(stored.publicRedactedDescription, null);
  assert.equal(stored.status, 'received');
  assert.equal(stored.normalizedIdentifierHash?.length, 64);
  assert.equal(result.recoveryKey, fixedRecoveryKey);
  assert.equal(result.recoveryKeyStatus, 'delivered');
});

test('same payload retries only re-deliver the random key inside the bounded delivery window', async () => {
  const repository = createMemoryRepository();
  const first = await submitRecruitmentReport(repository, request, idempotencyKey, securitySecret, deterministicDependencies);
  const retryInsideWindow = await submitRecruitmentReport(repository, request, idempotencyKey, securitySecret, {
    ...deterministicDependencies,
    createPublicId: () => 'R-ZYXWVUTSRQPONMLK',
    now: () => new Date('2026-08-11T10:05:00.000Z'),
  });
  const retryAtExpiry = await submitRecruitmentReport(repository, request, idempotencyKey, securitySecret, {
    ...deterministicDependencies,
    now: () => new Date(Date.parse('2026-08-11T10:00:00.000Z') + RECOVERY_KEY_DELIVERY_WINDOW_MS),
  });

  assert.equal(first.recoveryKey, fixedRecoveryKey);
  assert.equal(retryInsideWindow.recoveryKey, fixedRecoveryKey);
  assert.equal(retryAtExpiry.report.reportId, first.report.reportId);
  assert.equal(retryAtExpiry.recoveryKey, null);
  assert.equal(retryAtExpiry.recoveryKeyStatus, 'unavailable');
  assert.deepEqual(repository.cleared, [first.report.reportId]);
  assert.equal(repository.created.length, 1);
});

test('same idempotency key cannot be reused for different private report details', async () => {
  const repository = createMemoryRepository();
  await submitRecruitmentReport(repository, request, idempotencyKey, securitySecret, deterministicDependencies);
  await assert.rejects(
    submitRecruitmentReport(
      repository,
      { ...request, description: 'Different factual details.' },
      idempotencyKey,
      securitySecret,
      deterministicDependencies,
    ),
    ReportIdempotencyConflictError,
  );
  assert.equal(repository.created.length, 1);
});

test('concurrent duplicate creation resolves to the authoritative stored report', async () => {
  let lookupCount = 0;
  let captured: CreateRecruitmentReportInput | undefined;
  const repository: ReportsRepository = {
    async findByIdempotencyHash() {
      lookupCount += 1;
      if (lookupCount === 1) return null;
      return captured ? toRecord(captured) : null;
    },
    async findStatusByPublicId() {
      return null;
    },
    async create(input) {
      captured = input;
      throw new Error('unique constraint');
    },
    async clearRecoveryKeyDelivery() {},
    async clearExpiredRecoveryKeyDeliveries() { return 0; },
  };
  const result = await submitRecruitmentReport(repository, request, idempotencyKey, securitySecret, deterministicDependencies);
  assert.equal(result.report.reportId, 'R-23456789ABCDEFGH');
  assert.equal(result.recoveryKey, fixedRecoveryKey);
  assert.equal(lookupCount, 2);
});

test('Unicode, full-width, Arabic-Indic and zero-width identifiers are normalized and redacted fail-closed', () => {
  const fixtures = [
    '@nguyễn',
    'người@example.vn',
    '+٨٤ ٩١٢ ٣٤٥ ٦٧٨',
    'ＡＢ１２３４５６',
    '@nguy\u200bễn',
    'người@exa\u200bmple.vn',
    'AB12\u200b3456',
  ];
  for (const fixture of fixtures) {
    assert.equal(containsPotentialDirectIdentifierOnServer(fixture), true, fixture);
    const redacted = redactSensitiveReportTextOnServer(`Contact ${fixture} for this role.`);
    assert.equal(containsPotentialDirectIdentifierOnServer(redacted), false, redacted);
    assert.equal(redacted.includes(normalizeSensitiveReportText(fixture)), false, fixture);
  }
});

test('Unicode identifiers never appear in plaintext persistence or response fields when a derivative is allowed', async () => {
  const repository = createMemoryRepository();
  const privateValues = [
    '@nguyễn',
    'người@example.vn',
    '+٨٤ ٩١٢ ٣٤٥ ٦٧٨',
    'ＡＢ１２３４５６',
    '@nguy\u200bễn',
    'người@exa\u200bmple.vn',
    'AB12\u200b3456',
  ];
  const unicodeRequest: ReportSubmissionRequest = {
    ...request,
    identifier: '@nguyễn',
    description: privateValues.join(' · '),
    redactedPreview: privateValues.join(' · '),
    permissions: { ...request.permissions, allowRedactedPublicAlert: true },
  };
  const result = await submitRecruitmentReport(repository, unicodeRequest, idempotencyKey, securitySecret, deterministicDependencies);
  const persisted = JSON.stringify(repository.created[0]);
  const response = JSON.stringify(result);
  for (const value of privateValues) {
    const normalized = normalizeSensitiveReportText(value);
    assert.equal(persisted.includes(value), false, value);
    assert.equal(persisted.includes(normalized), false, normalized);
    assert.equal(response.includes(value), false, value);
    assert.equal(response.includes(normalized), false, normalized);
  }
});

test('AES-GCM AAD rejects cross-report and cross-field ciphertext swaps', () => {
  const keys = deriveReportSecurityKeys(securitySecret);
  const ciphertext = encryptPrivateReportText(
    'private value',
    keys.privateDataEncryption,
    { publicReportId: 'R-23456789ABCDEFGH', fieldName: 'privateIdentifier' },
    Buffer.alloc(12, 7),
  );
  assert.equal(decryptPrivateReportText(
    ciphertext,
    keys.privateDataEncryption,
    { publicReportId: 'R-23456789ABCDEFGH', fieldName: 'privateIdentifier' },
  ), 'private value');
  assert.throws(() => decryptPrivateReportText(
    ciphertext,
    keys.privateDataEncryption,
    { publicReportId: 'R-23456789ABCDEFGJ', fieldName: 'privateIdentifier' },
  ));
  assert.throws(() => decryptPrivateReportText(
    ciphertext,
    keys.privateDataEncryption,
    { publicReportId: 'R-23456789ABCDEFGH', fieldName: 'privateDescription' },
  ));
});

test('random recovery key generation produces independent 128-bit credentials', () => {
  const first = createRandomRecoveryKey();
  const second = createRandomRecoveryKey();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){5}-[A-Z2-9]{2}$/u);
});
