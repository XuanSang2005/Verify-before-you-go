import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  assertLocalV1CleanupEnvironment,
  AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS,
  deleteAuthorizedLocalSyntheticV1Reports,
} from '../src/modules/reports/reports.local-v1-cleanup.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for guarded local cleanup.');

assertLocalV1CleanupEnvironment(connectionString, process.env.NODE_ENV, process.argv[2]);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const deleted = await prisma.$transaction(async (transaction) => deleteAuthorizedLocalSyntheticV1Reports({
    loadAuthorizedCandidates: (publicIds) => transaction.recruitmentReport.findMany({
      where: { publicId: { in: [...publicIds] } },
      select: {
        publicId: true,
        submittedAt: true,
        status: true,
        privateIdentifier: true,
        privateDescription: true,
        namedPartner: true,
        recoveryKeyDeliveryCiphertext: true,
        recoveryKeyDeliverUntil: true,
      },
    }),
    deleteAuthorizedCandidates: async () => {
      const result = await transaction.recruitmentReport.deleteMany({
        where: {
          OR: AUTHORIZED_LOCAL_SYNTHETIC_V1_REPORTS.map((report) => ({
            publicId: report.publicId,
            submittedAt: new Date(report.submittedAt),
          })),
          status: 'RECEIVED',
          privateIdentifier: { startsWith: 'aes-gcm-v1$' },
          privateDescription: { startsWith: 'aes-gcm-v1$' },
          namedPartner: null,
          recoveryKeyDeliveryCiphertext: null,
          recoveryKeyDeliverUntil: null,
        },
      });
      return result.count;
    },
  }));
  console.info(`Deleted ${deleted} authorized local synthetic v1 reports.`);
} finally {
  await prisma.$disconnect();
}
