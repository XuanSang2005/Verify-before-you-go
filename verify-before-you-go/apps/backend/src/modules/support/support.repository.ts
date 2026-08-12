import type {
  SupportAccessMode,
  SupportContactKind,
  SupportCountry,
  SupportDataStatus,
} from '@vbyg/contracts';

import type {
  PrismaClient,
  SupportAccessMode as PrismaSupportAccessMode,
  SupportContact as PrismaSupportContact,
  SupportContactKind as PrismaSupportContactKind,
  SupportCountry as PrismaSupportCountry,
  SupportDataStatus as PrismaSupportDataStatus,
} from '../../generated/prisma/client.js';

export type SupportContactRecord = {
  id: string;
  country: SupportCountry;
  countryLabel: string;
  kind: SupportContactKind;
  title: string;
  description: string;
  displayValue: string;
  actionUri: string;
  actionLabel: string;
  accessMode: SupportAccessMode;
  accessLabel: string;
  dataStatus: SupportDataStatus;
  dataStatusLabel: string;
  sourceOwner: string;
  sourceUrl: string;
  languages: string[];
  hours: string;
  lastReviewedAt: Date;
  nextReviewAt: Date;
  sortOrder: number;
};

export interface SupportRepository {
  list: (country?: SupportCountry) => Promise<SupportContactRecord[]>;
}

const countryToPrisma: Record<SupportCountry, PrismaSupportCountry> = {
  cambodia: 'CAMBODIA',
  vietnam: 'VIETNAM',
};

const countryFromPrisma: Record<PrismaSupportCountry, SupportCountry> = {
  CAMBODIA: 'cambodia',
  VIETNAM: 'vietnam',
};

const kindFromPrisma: Record<PrismaSupportContactKind, SupportContactKind> = {
  EMERGENCY: 'emergency',
  EMBASSY: 'embassy',
  ORGANIZATION: 'organization',
};

const accessModeFromPrisma: Record<PrismaSupportAccessMode, SupportAccessMode> = {
  CELLULAR: 'cellular',
  INTERNET: 'internet',
};

const dataStatusFromPrisma: Record<PrismaSupportDataStatus, SupportDataStatus> = {
  REVIEWED_REFERENCE: 'reviewed-reference',
  SYNTHETIC_SUMMARY: 'synthetic-summary',
};

function mapSupportContact(row: PrismaSupportContact): SupportContactRecord {
  return {
    id: row.id,
    country: countryFromPrisma[row.country],
    countryLabel: row.countryLabel,
    kind: kindFromPrisma[row.kind],
    title: row.title,
    description: row.description,
    displayValue: row.displayValue,
    actionUri: row.actionUri,
    actionLabel: row.actionLabel,
    accessMode: accessModeFromPrisma[row.accessMode],
    accessLabel: row.accessLabel,
    dataStatus: dataStatusFromPrisma[row.dataStatus],
    dataStatusLabel: row.dataStatusLabel,
    sourceOwner: row.sourceOwner,
    sourceUrl: row.sourceUrl,
    languages: row.languages,
    hours: row.hours,
    lastReviewedAt: row.lastReviewedAt,
    nextReviewAt: row.nextReviewAt,
    sortOrder: row.sortOrder,
  };
}

export function createPrismaSupportRepository(prisma: PrismaClient): SupportRepository {
  return {
    async list(country) {
      const rows = await prisma.supportContact.findMany({
        where: {
          isActive: true,
          ...(country ? { country: countryToPrisma[country] } : {}),
        },
        orderBy: [{ country: 'asc' }, { sortOrder: 'asc' }],
      });
      return rows.map(mapSupportContact);
    },
  };
}

export const emptySupportRepository: SupportRepository = {
  list: async () => [],
};
