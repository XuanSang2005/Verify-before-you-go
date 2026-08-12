import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedCommunityAlerts } from '../src/modules/alerts/alerts.seed-data.js';
import { seedNewsStories } from '../src/modules/news/news.seed-data.js';
import { seedSupportContacts } from '../src/modules/support/support.seed-data.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
await prisma.foundationMetadata.upsert({
  where: { id: 'local-foundation' },
  update: { schemaVersion: 'cp14-v1' },
  create: { id: 'local-foundation', schemaVersion: 'cp14-v1' },
});

for (const story of seedNewsStories) {
  const category = {
    'hiring-update': 'HIRING_UPDATE',
    'scam-watch': 'SCAM_WATCH',
    guide: 'GUIDE',
    'mil-explainer': 'MIL_EXPLAINER',
  }[story.category] as 'HIRING_UPDATE' | 'SCAM_WATCH' | 'GUIDE' | 'MIL_EXPLAINER';
  const sourceStatus = story.sourceStatus === 'synthetic-source-list'
    ? 'SYNTHETIC_SOURCE_LIST'
    : 'SYNTHETIC_PROTOTYPE';

  await prisma.newsArticle.upsert({
    where: { slug: story.slug },
    update: { ...story, category, sourceStatus },
    create: { ...story, category, sourceStatus },
  });
}

for (const alert of seedCommunityAlerts) {
  const location = {
    cambodia: 'CAMBODIA',
    vietnam: 'VIETNAM',
    regional: 'REGIONAL',
  }[alert.location] as 'CAMBODIA' | 'VIETNAM' | 'REGIONAL';
  const category = {
    'identity-document': 'IDENTITY_DOCUMENT',
    'off-platform-contact': 'OFF_PLATFORM_CONTACT',
    'licence-claim': 'LICENCE_CLAIM',
    'upfront-payment': 'UPFRONT_PAYMENT',
  }[alert.category] as 'IDENTITY_DOCUMENT' | 'OFF_PLATFORM_CONTACT' | 'LICENCE_CLAIM' | 'UPFRONT_PAYMENT';
  const moderationStatus = {
    'corroborated-pattern': 'CORROBORATED_PATTERN',
    'official-source-mismatch': 'OFFICIAL_SOURCE_MISMATCH',
    'reviewed-pattern': 'REVIEWED_PATTERN',
  }[alert.moderationStatus] as 'CORROBORATED_PATTERN' | 'OFFICIAL_SOURCE_MISMATCH' | 'REVIEWED_PATTERN';

  await prisma.communityAlert.upsert({
    where: { id: alert.id },
    update: { ...alert, location, category, moderationStatus },
    create: { ...alert, location, category, moderationStatus },
  });
}

for (const contact of seedSupportContacts) {
  const country = contact.country === 'cambodia' ? 'CAMBODIA' : 'VIETNAM';
  const kind = {
    emergency: 'EMERGENCY',
    embassy: 'EMBASSY',
    organization: 'ORGANIZATION',
  }[contact.kind] as 'EMERGENCY' | 'EMBASSY' | 'ORGANIZATION';
  const accessMode = contact.accessMode === 'cellular' ? 'CELLULAR' : 'INTERNET';
  const dataStatus = contact.dataStatus === 'reviewed-reference'
    ? 'REVIEWED_REFERENCE'
    : 'SYNTHETIC_SUMMARY';

  await prisma.supportContact.upsert({
    where: { id: contact.id },
    update: { ...contact, country, kind, accessMode, dataStatus },
    create: { ...contact, country, kind, accessMode, dataStatus },
  });
}
await prisma.$disconnect();
console.info(
  `Seeded deterministic CP14 foundation metadata, ${seedNewsStories.length} synthetic news stories, ${seedCommunityAlerts.length} reviewed synthetic alerts and ${seedSupportContacts.length} support-directory entries.`,
);
