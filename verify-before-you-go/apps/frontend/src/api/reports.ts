import {
  ApiErrorSchema,
  ReportSubmissionRequestSchema,
  ReportSubmissionResponseSchema,
  type ReportSubmissionRequest,
  type ReportSubmissionResponse,
} from '@vbyg/contracts';

import type { ReportDraft } from '../features/reports/report-model';
import { prepareReportDraft } from '../features/reports/report-model';
import { createReportRedactionPreview } from '../features/reports/report-redaction';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/u, '');

export type ReportSubmissionFailureKind = 'network' | 'http' | 'invalid-response';

export class ReportSubmissionError extends Error {
  constructor(
    public readonly kind: ReportSubmissionFailureKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ReportSubmissionError';
  }
}

export function createReportSubmissionRequest(draft: ReportDraft): ReportSubmissionRequest {
  const prepared = prepareReportDraft(draft);
  const request = {
    subjectType: prepared.subjectType,
    identifierType: prepared.identifierType,
    identifier: prepared.identifier,
    behaviourIds: prepared.behaviourIds,
    description: prepared.description,
    redactedPreview: prepared.redactedPreview
      ?? createReportRedactionPreview(prepared).possiblePublicVersion,
    permissions: {
      ...prepared.permissions,
      namedPartner: prepared.permissions.shareWithNamedPartner
        ? prepared.permissions.namedPartner
        : '',
    },
  };
  return ReportSubmissionRequestSchema.parse(request);
}

export async function submitPrivateReport(
  request: ReportSubmissionRequest,
  idempotencyKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ReportSubmissionResponse> {
  let response: Response;
  try {
    response = await fetchImplementation(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(ReportSubmissionRequestSchema.parse(request)),
    });
  } catch {
    throw new ReportSubmissionError(
      'network',
      'The private report service could not be reached. Your local draft is still available.',
    );
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    throw new ReportSubmissionError(
      'http',
      parsed.success
        ? parsed.data.error.message
        : 'The private report could not be submitted. Your local draft is still available.',
      response.status,
    );
  }
  const parsed = ReportSubmissionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ReportSubmissionError(
      'invalid-response',
      'The service returned an invalid receipt. No receipt has been created in this app session.',
      response.status,
    );
  }
  return parsed.data;
}
