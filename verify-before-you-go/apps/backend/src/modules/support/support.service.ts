import {
  SupportDirectoryResponseSchema,
  type SupportDirectoryQuery,
  type SupportDirectoryResponse,
} from '@vbyg/contracts';

import type { SupportRepository } from './support.repository.js';

export const SUPPORT_DIRECTORY_NOTICE =
  'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.' as const;

export async function listSupportContacts(
  repository: SupportRepository,
  query: SupportDirectoryQuery,
  now: () => Date = () => new Date(),
): Promise<SupportDirectoryResponse> {
  const requestTime = now();
  const records = await repository.list(query.country);
  return SupportDirectoryResponseSchema.parse({
    schemaVersion: 1,
    contacts: records.map((record) => ({
      ...record,
      lastReviewedAt: record.lastReviewedAt.toISOString(),
      nextReviewAt: record.nextReviewAt.toISOString(),
      reviewStatus: record.nextReviewAt.getTime() >= requestTime.getTime() ? 'current' : 'review-due',
    })),
    fetchedAt: requestTime.toISOString(),
    directoryNotice: SUPPORT_DIRECTORY_NOTICE,
  });
}
