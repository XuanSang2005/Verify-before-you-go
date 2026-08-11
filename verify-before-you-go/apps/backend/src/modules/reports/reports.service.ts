import {
  ReportIdempotencyKeySchema,
  ReportSubmissionRequestSchema,
  ReportSubmissionResponseSchema,
  type ReportSubmissionRequest,
  type ReportSubmissionResponse,
} from '@vbyg/contracts';

import {
  redactReportIdentifierOnServer,
  redactSensitiveReportTextOnServer,
} from './reports.redaction.js';
import type {
  CreateRecruitmentReportInput,
  RecruitmentReportRecord,
  ReportsRepository,
} from './reports.repository.js';
import {
  createPublicReportId,
  createRandomRecoveryKey,
  decryptPrivateReportText,
  deriveReportSecurityKeys,
  encryptPrivateReportText,
  hashIdempotencyKey,
  hashNormalizedIdentifier,
  hashRecoveryKey,
  hashSubmissionPayload,
  type ReportSecurityKeys,
} from './reports.security.js';

export const PRIVATE_INTAKE_NOTICE =
  'This private receipt does not mean the report has been reviewed, verified or published.' as const;
export const RECOVERY_KEY_DELIVERY_WINDOW_MS = 10 * 60 * 1_000;

export class ReportIdempotencyConflictError extends Error {
  constructor() {
    super('This submission key was already used for different report details.');
    this.name = 'ReportIdempotencyConflictError';
  }
}

export interface SubmitReportDependencies {
  createPublicId?: () => string;
  createRecoveryKey?: () => string;
  hashRecoverySecret?: (key: string) => Promise<string>;
  now?: () => Date;
}

export async function submitRecruitmentReport(
  repository: ReportsRepository,
  rawRequest: unknown,
  rawIdempotencyKey: unknown,
  reportSecuritySecret: string,
  dependencies: SubmitReportDependencies = {},
): Promise<ReportSubmissionResponse> {
  const request = ReportSubmissionRequestSchema.parse(rawRequest);
  const idempotencyKey = ReportIdempotencyKeySchema.parse(rawIdempotencyKey);
  const keys = deriveReportSecurityKeys(reportSecuritySecret);
  const canonicalPayload = canonicalizeSubmission(request);
  const submissionPayloadHash = hashSubmissionPayload(canonicalPayload, keys.payloadHmac);
  const idempotencyKeyHash = hashIdempotencyKey(idempotencyKey, keys.idempotencyHmac);
  const now = (dependencies.now ?? (() => new Date()))();
  const existing = await repository.findByIdempotencyHash(idempotencyKeyHash);
  if (existing) {
    return createIdempotentReceipt(repository, existing, submissionPayloadHash, keys, now);
  }

  const publicId = (dependencies.createPublicId ?? createPublicReportId)();
  const recoveryKey = (dependencies.createRecoveryKey ?? createRandomRecoveryKey)();
  const recoveryKeyHash = await (dependencies.hashRecoverySecret ?? hashRecoveryKey)(recoveryKey);
  const recoveryKeyDeliverUntil = new Date(now.getTime() + RECOVERY_KEY_DELIVERY_WINDOW_MS);
  const input = createStorageInput({
    idempotencyKeyHash,
    keys,
    publicId,
    recoveryKey,
    recoveryKeyDeliverUntil,
    recoveryKeyHash,
    request,
    submissionPayloadHash,
    submittedAt: now,
  });

  try {
    const created = await repository.create(input);
    return createReceipt(created, recoveryKey);
  } catch (error) {
    const concurrent = await repository.findByIdempotencyHash(idempotencyKeyHash);
    if (concurrent) {
      return createIdempotentReceipt(repository, concurrent, submissionPayloadHash, keys, now);
    }
    throw error;
  }
}

function createStorageInput({
  idempotencyKeyHash,
  keys,
  publicId,
  recoveryKey,
  recoveryKeyDeliverUntil,
  recoveryKeyHash,
  request,
  submissionPayloadHash,
  submittedAt,
}: {
  idempotencyKeyHash: string;
  keys: ReportSecurityKeys;
  publicId: string;
  recoveryKey: string;
  recoveryKeyDeliverUntil: Date;
  recoveryKeyHash: string;
  request: ReportSubmissionRequest;
  submissionPayloadHash: string;
  submittedAt: Date;
}): CreateRecruitmentReportInput {
  const publicSource = request.redactedPreview ?? request.description;
  const mayCreatePublicDerivative = request.permissions.allowRedactedPublicAlert;
  return {
    publicId,
    status: 'received',
    subjectType: request.subjectType,
    identifierType: request.identifierType,
    privateIdentifier: encryptPrivateReportText(
      request.identifier,
      keys.privateDataEncryption,
      { publicReportId: publicId, fieldName: 'privateIdentifier' },
    ),
    normalizedIdentifierHash: request.permissions.useForPrivateMatching
      ? hashNormalizedIdentifier(request.identifierType, request.identifier, keys.identifierHmac)
      : null,
    privateDescription: encryptPrivateReportText(
      request.description,
      keys.privateDataEncryption,
      { publicReportId: publicId, fieldName: 'privateDescription' },
    ),
    publicRedactedIdentifier: mayCreatePublicDerivative
      ? redactReportIdentifierOnServer(request.identifierType, request.identifier)
      : null,
    publicRedactedDescription: mayCreatePublicDerivative
      ? redactSensitiveReportTextOnServer(publicSource)
      : null,
    behaviours: request.behaviourIds,
    allowPrivateMatching: request.permissions.useForPrivateMatching,
    allowRedactedPublicAlert: mayCreatePublicDerivative,
    shareWithNamedPartner: request.permissions.shareWithNamedPartner,
    namedPartner: request.permissions.shareWithNamedPartner
      ? encryptPrivateReportText(
          request.permissions.namedPartner,
          keys.privateDataEncryption,
          { publicReportId: publicId, fieldName: 'namedPartner' },
        )
      : null,
    idempotencyKeyHash,
    submissionPayloadHash,
    recoveryKeyHash,
    recoveryKeyDeliveryCiphertext: encryptPrivateReportText(
      recoveryKey,
      keys.recoveryDeliveryEncryption,
      { publicReportId: publicId, fieldName: 'recoveryKeyDelivery' },
    ),
    recoveryKeyDeliverUntil,
    submittedAt,
  };
}

function canonicalizeSubmission(request: ReportSubmissionRequest): string {
  return JSON.stringify({
    subjectType: request.subjectType,
    identifierType: request.identifierType,
    identifier: request.identifier,
    behaviourIds: request.behaviourIds.toSorted(),
    description: request.description,
    redactedPreview: request.redactedPreview ?? null,
    permissions: {
      useForPrivateMatching: request.permissions.useForPrivateMatching,
      allowRedactedPublicAlert: request.permissions.allowRedactedPublicAlert,
      shareWithNamedPartner: request.permissions.shareWithNamedPartner,
      namedPartner: request.permissions.shareWithNamedPartner ? request.permissions.namedPartner : '',
    },
  });
}

async function createIdempotentReceipt(
  repository: ReportsRepository,
  record: RecruitmentReportRecord,
  expectedPayloadHash: string,
  keys: ReportSecurityKeys,
  now: Date,
): Promise<ReportSubmissionResponse> {
  if (record.submissionPayloadHash !== expectedPayloadHash) throw new ReportIdempotencyConflictError();
  if (!record.recoveryKeyDeliveryCiphertext
    || !record.recoveryKeyDeliverUntil
    || record.recoveryKeyDeliverUntil.getTime() < now.getTime()) {
    await repository.clearRecoveryKeyDelivery(record.publicId).catch(() => undefined);
    return createReceipt(record, null);
  }
  try {
    const recoveryKey = decryptPrivateReportText(
      record.recoveryKeyDeliveryCiphertext,
      keys.recoveryDeliveryEncryption,
      { publicReportId: record.publicId, fieldName: 'recoveryKeyDelivery' },
    );
    return createReceipt(record, recoveryKey);
  } catch {
    await repository.clearRecoveryKeyDelivery(record.publicId).catch(() => undefined);
    return createReceipt(record, null);
  }
}

function createReceipt(record: RecruitmentReportRecord, recoveryKey: string | null): ReportSubmissionResponse {
  return ReportSubmissionResponseSchema.parse({
    report: {
      reportId: record.publicId,
      submittedAt: record.submittedAt.toISOString(),
      status: 'received',
      statusLabel: 'Received — not yet reviewed.',
      privateIntakeNotice: PRIVATE_INTAKE_NOTICE,
    },
    recoveryKey,
    recoveryKeyStatus: recoveryKey ? 'delivered' : 'unavailable',
  });
}
