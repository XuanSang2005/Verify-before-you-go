import type {
  ReportBehaviourId,
  ReportIdentifierType,
  ReportSubjectType,
} from '@vbyg/contracts';

import type {
  PrismaClient,
  RecruitmentReportBehaviour,
  RecruitmentReportIdentifierType,
  RecruitmentReportSubjectType,
} from '../../generated/prisma/client.js';

export interface RecruitmentReportRecord {
  publicId: string;
  idempotencyKeyHash: string;
  submissionPayloadHash: string;
  submittedAt: Date;
  recoveryKeyDeliveryCiphertext: string | null;
  recoveryKeyDeliverUntil: Date | null;
}

export interface CreateRecruitmentReportInput extends RecruitmentReportRecord {
  status: 'received';
  subjectType: ReportSubjectType;
  identifierType: ReportIdentifierType;
  privateIdentifier: string;
  normalizedIdentifierHash: string | null;
  privateDescription: string;
  publicRedactedIdentifier: string | null;
  publicRedactedDescription: string | null;
  behaviours: ReportBehaviourId[];
  allowPrivateMatching: boolean;
  allowRedactedPublicAlert: boolean;
  shareWithNamedPartner: boolean;
  namedPartner: string | null;
  recoveryKeyHash: string;
  recoveryKeyDeliveryCiphertext: string;
  recoveryKeyDeliverUntil: Date;
}

export interface ReportsRepository {
  findByIdempotencyHash: (hash: string) => Promise<RecruitmentReportRecord | null>;
  create: (input: CreateRecruitmentReportInput) => Promise<RecruitmentReportRecord>;
  clearRecoveryKeyDelivery: (publicId: string) => Promise<void>;
}

const subjectTypeToPrisma: Record<ReportSubjectType, RecruitmentReportSubjectType> = {
  'job-post': 'JOB_POST',
  recruiter: 'RECRUITER',
  company: 'COMPANY',
  agency: 'AGENCY',
};

const identifierTypeToPrisma: Record<ReportIdentifierType, RecruitmentReportIdentifierType> = {
  url: 'URL',
  phone: 'PHONE',
  handle: 'HANDLE',
  'payment-account': 'PAYMENT_ACCOUNT',
  'claimed-entity': 'CLAIMED_ENTITY',
};

const behaviourToPrisma: Record<ReportBehaviourId, RecruitmentReportBehaviour> = {
  'identity-document-request': 'IDENTITY_DOCUMENT_REQUEST',
  'payment-request': 'PAYMENT_REQUEST',
  pressure: 'PRESSURE',
  'company-not-found': 'COMPANY_NOT_FOUND',
  'contract-visa-mismatch': 'CONTRACT_VISA_MISMATCH',
  'travel-accommodation-control': 'TRAVEL_ACCOMMODATION_CONTROL',
  impersonation: 'IMPERSONATION',
};

export function createPrismaReportsRepository(prisma: PrismaClient): ReportsRepository {
  return {
    async findByIdempotencyHash(hash) {
      const row = await prisma.recruitmentReport.findUnique({
        where: { idempotencyKeyHash: hash },
        select: {
          publicId: true,
          idempotencyKeyHash: true,
          submissionPayloadHash: true,
          submittedAt: true,
          recoveryKeyDeliveryCiphertext: true,
          recoveryKeyDeliverUntil: true,
        },
      });
      return row;
    },
    async create(input) {
      return prisma.recruitmentReport.create({
        data: {
          publicId: input.publicId,
          status: 'RECEIVED',
          subjectType: subjectTypeToPrisma[input.subjectType],
          identifierType: identifierTypeToPrisma[input.identifierType],
          privateIdentifier: input.privateIdentifier,
          normalizedIdentifierHash: input.normalizedIdentifierHash,
          privateDescription: input.privateDescription,
          publicRedactedIdentifier: input.publicRedactedIdentifier,
          publicRedactedDescription: input.publicRedactedDescription,
          behaviours: input.behaviours.map((behaviour) => behaviourToPrisma[behaviour]),
          allowPrivateMatching: input.allowPrivateMatching,
          allowRedactedPublicAlert: input.allowRedactedPublicAlert,
          shareWithNamedPartner: input.shareWithNamedPartner,
          namedPartner: input.namedPartner,
          idempotencyKeyHash: input.idempotencyKeyHash,
          submissionPayloadHash: input.submissionPayloadHash,
          recoveryKeyHash: input.recoveryKeyHash,
          recoveryKeyDeliveryCiphertext: input.recoveryKeyDeliveryCiphertext,
          recoveryKeyDeliverUntil: input.recoveryKeyDeliverUntil,
          submittedAt: input.submittedAt,
        },
        select: {
          publicId: true,
          idempotencyKeyHash: true,
          submissionPayloadHash: true,
          submittedAt: true,
          recoveryKeyDeliveryCiphertext: true,
          recoveryKeyDeliverUntil: true,
        },
      });
    },
    async clearRecoveryKeyDelivery(publicId) {
      await prisma.recruitmentReport.updateMany({
        where: { publicId },
        data: {
          recoveryKeyDeliveryCiphertext: null,
          recoveryKeyDeliverUntil: null,
        },
      });
    },
  };
}

export const unavailableReportsRepository: ReportsRepository = {
  findByIdempotencyHash: async () => null,
  create: async () => {
    throw new Error('Reports repository is unavailable.');
  },
  clearRecoveryKeyDelivery: async () => undefined,
};
