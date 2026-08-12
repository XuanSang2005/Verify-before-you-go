import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { buildApp } from './app.js';
import { loadEnvironment } from './config/env.js';
import { PrismaClient } from './generated/prisma/client.js';
import { createPrismaAlertsRepository } from './modules/alerts/alerts.repository.js';
import { createPrismaNewsRepository } from './modules/news/news.repository.js';
import { createPrismaReportsRepository } from './modules/reports/reports.repository.js';
import { createPrismaSupportRepository } from './modules/support/support.repository.js';

const environment = loadEnvironment();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }) });
const app = await buildApp({
  corsOrigins: environment.corsOrigins,
  databaseCheck: async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  },
  logger: { level: environment.LOG_LEVEL },
  alertsRepository: createPrismaAlertsRepository(prisma),
  newsRepository: createPrismaNewsRepository(prisma),
  reportsRepository: createPrismaReportsRepository(prisma),
  supportRepository: createPrismaSupportRepository(prisma),
  reportSecuritySecret: environment.REPORT_SECURITY_SECRET,
});

const close = async (): Promise<void> => {
  await app.close();
  await prisma.$disconnect();
};
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
await app.listen({ host: '0.0.0.0', port: environment.PORT });
