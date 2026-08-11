import type {
  AlertDetail,
  AlertDetailResponse,
  AlertListQuery,
  AlertListResponse,
  AlertSummary,
} from '@vbyg/contracts';
import {
  AlertDetailResponseSchema,
  AlertDetailSchema,
  AlertListResponseSchema,
} from '@vbyg/contracts';

import type { AlertsRepository } from './alerts.repository.js';

export const SYNTHETIC_ALERTS_NOTICE =
  'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.' as const;

export class CommunityAlertNotFoundError extends Error {
  constructor() {
    super('The requested reviewed synthetic alert was not found.');
    this.name = 'CommunityAlertNotFoundError';
  }
}

export class InvalidPublicAlertDataError extends Error {
  constructor() {
    super('A reviewed alert could not be safely published.');
    this.name = 'InvalidPublicAlertDataError';
  }
}

function validatePublicAlert(value: unknown): AlertDetail {
  const parsed = AlertDetailSchema.safeParse(value);
  if (!parsed.success) throw new InvalidPublicAlertDataError();
  return parsed.data;
}

function validateListResponse(value: unknown): AlertListResponse {
  const parsed = AlertListResponseSchema.safeParse(value);
  if (!parsed.success) throw new InvalidPublicAlertDataError();
  return parsed.data;
}

function validateDetailResponse(value: unknown): AlertDetailResponse {
  const parsed = AlertDetailResponseSchema.safeParse(value);
  if (!parsed.success) throw new InvalidPublicAlertDataError();
  return parsed.data;
}

export async function listCommunityAlerts(
  repository: AlertsRepository,
  query: AlertListQuery,
  now: () => Date = () => new Date(),
): Promise<AlertListResponse> {
  const alerts = await repository.list(query);
  const summaries: AlertSummary[] = alerts.map((value) => {
    const alert = validatePublicAlert(value);
    return {
      id: alert.id,
      title: alert.title,
      location: alert.location,
      locationLabel: alert.locationLabel,
      category: alert.category,
      categoryLabel: alert.categoryLabel,
      moderationStatus: alert.moderationStatus,
      moderationStatusLabel: alert.moderationStatusLabel,
      summary: alert.summary,
      compatibleReportCount: alert.compatibleReportCount,
      maskedIdentifiers: alert.maskedIdentifiers,
      syntheticLabel: alert.syntheticLabel,
      firstReportedAt: alert.firstReportedAt,
      reviewedAt: alert.reviewedAt,
    };
  });
  return validateListResponse({
    alerts: summaries,
    fetchedAt: now().toISOString(),
    syntheticContentNotice: SYNTHETIC_ALERTS_NOTICE,
  });
}

export async function getCommunityAlert(
  repository: AlertsRepository,
  id: string,
): Promise<AlertDetailResponse> {
  const alert = await repository.findById(id);
  if (!alert) throw new CommunityAlertNotFoundError();
  return validateDetailResponse({ alert: validatePublicAlert(alert) });
}
