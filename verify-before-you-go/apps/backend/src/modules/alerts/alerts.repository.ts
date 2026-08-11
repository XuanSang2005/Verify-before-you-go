import type {
  AlertCategory,
  AlertDetail,
  AlertListQuery,
  AlertLocation,
  AlertModerationStatus,
} from '@vbyg/contracts';

import type {
  AlertCategory as PrismaAlertCategory,
  AlertLocation as PrismaAlertLocation,
  AlertModerationStatus as PrismaAlertModerationStatus,
  CommunityAlert,
  PrismaClient,
} from '../../generated/prisma/client.js';

export interface AlertsRepository {
  list: (query: AlertListQuery) => Promise<AlertDetail[]>;
  findById: (id: string) => Promise<AlertDetail | null>;
}

const locationToPrisma: Record<AlertLocation, PrismaAlertLocation> = {
  cambodia: 'CAMBODIA',
  vietnam: 'VIETNAM',
  regional: 'REGIONAL',
};

const locationFromPrisma: Record<PrismaAlertLocation, AlertLocation> = {
  CAMBODIA: 'cambodia',
  VIETNAM: 'vietnam',
  REGIONAL: 'regional',
};

const categoryToPrisma: Record<AlertCategory, PrismaAlertCategory> = {
  'identity-document': 'IDENTITY_DOCUMENT',
  'off-platform-contact': 'OFF_PLATFORM_CONTACT',
  'licence-claim': 'LICENCE_CLAIM',
  'upfront-payment': 'UPFRONT_PAYMENT',
};

const categoryFromPrisma: Record<PrismaAlertCategory, AlertCategory> = {
  IDENTITY_DOCUMENT: 'identity-document',
  OFF_PLATFORM_CONTACT: 'off-platform-contact',
  LICENCE_CLAIM: 'licence-claim',
  UPFRONT_PAYMENT: 'upfront-payment',
};

const moderationFromPrisma: Record<PrismaAlertModerationStatus, AlertModerationStatus> = {
  CORROBORATED_PATTERN: 'corroborated-pattern',
  OFFICIAL_SOURCE_MISMATCH: 'official-source-mismatch',
  REVIEWED_PATTERN: 'reviewed-pattern',
};

function mapCommunityAlert(row: CommunityAlert): AlertDetail {
  return {
    id: row.id,
    title: row.title,
    location: locationFromPrisma[row.location],
    locationLabel: row.locationLabel,
    category: categoryFromPrisma[row.category],
    categoryLabel: row.categoryLabel,
    moderationStatus: moderationFromPrisma[row.moderationStatus],
    moderationStatusLabel: row.moderationStatusLabel,
    summary: row.summary,
    compatibleReportCount: row.compatibleReportCount,
    maskedIdentifiers: row.maskedIdentifiers,
    syntheticLabel: 'Synthetic demo data',
    observedEvidence: row.observedEvidence,
    unknownInformation: row.unknownInformation,
    verificationSteps: row.verificationSteps,
    sourceNotes: row.sourceNotes,
    safetyStatement: 'This reviewed record is not a verdict and does not establish fraud.',
    firstReportedAt: row.firstReportedAt.toISOString(),
    reviewedAt: row.reviewedAt.toISOString(),
  };
}

function includesSearch(alert: AlertDetail, search: string): boolean {
  const normalized = search.toLocaleLowerCase('en');
  return [
    alert.id,
    alert.title,
    alert.locationLabel,
    alert.categoryLabel,
    alert.moderationStatusLabel,
    alert.summary,
    ...alert.maskedIdentifiers,
  ].some((value) => value.toLocaleLowerCase('en').includes(normalized));
}

export function createPrismaAlertsRepository(prisma: PrismaClient): AlertsRepository {
  return {
    async list(query) {
      const rows = await prisma.communityAlert.findMany({
        where: {
          location: query.location ? locationToPrisma[query.location] : undefined,
          category: query.category ? categoryToPrisma[query.category] : undefined,
        },
        orderBy: [{ reviewedAt: 'desc' }, { id: 'asc' }],
      });
      const alerts = rows.map(mapCommunityAlert);
      return query.search ? alerts.filter((alert) => includesSearch(alert, query.search ?? '')) : alerts;
    },
    async findById(id) {
      const row = await prisma.communityAlert.findUnique({ where: { id } });
      return row ? mapCommunityAlert(row) : null;
    },
  };
}

export const emptyAlertsRepository: AlertsRepository = {
  list: async () => [],
  findById: async () => null,
};
