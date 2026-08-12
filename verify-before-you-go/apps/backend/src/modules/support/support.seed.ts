import {
  retiredSupportContactIds,
  seedSupportContacts,
} from './support.seed-data.js';

type SupportSeedWrite = {
  where: { id: string };
  update: Record<string, unknown>;
  create: Record<string, unknown>;
};

export interface SupportSeedPort {
  supportContact: {
    upsert: (write: SupportSeedWrite) => Promise<unknown>;
    updateMany: (write: {
      where: { id: { in: string[] } };
      data: { isActive: false };
    }) => Promise<unknown>;
  };
}

export async function reconcileSupportDirectorySeed(port: SupportSeedPort): Promise<void> {
  for (const contact of seedSupportContacts) {
    const country = contact.country === 'cambodia' ? 'CAMBODIA' : 'VIETNAM';
    const kind = {
      emergency: 'EMERGENCY',
      embassy: 'EMBASSY',
      consular: 'CONSULAR',
      organization: 'ORGANIZATION',
    }[contact.kind];
    const accessMode = contact.accessMode === 'cellular' ? 'CELLULAR' : 'INTERNET';
    const dataStatus = contact.dataStatus === 'reviewed-reference'
      ? 'REVIEWED_REFERENCE'
      : 'SYNTHETIC_SUMMARY';
    const languageStatus = contact.languageStatus === 'confirmed'
      ? 'CONFIRMED'
      : 'UNCONFIRMED';
    const persisted = {
      ...contact,
      country,
      kind,
      accessMode,
      dataStatus,
      languageStatus,
    };

    await port.supportContact.upsert({
      where: { id: contact.id },
      update: persisted,
      create: persisted,
    });
  }

  await port.supportContact.updateMany({
    where: { id: { in: [...retiredSupportContactIds] } },
    data: { isActive: false },
  });
}
