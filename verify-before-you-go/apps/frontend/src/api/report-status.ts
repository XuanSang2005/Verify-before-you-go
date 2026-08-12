import {
  ReportStatusLookupRequestSchema,
  ReportStatusLookupResponseSchema,
  type ReportStatusLookupRequest,
  type ReportStatusLookupResponse,
} from '@vbyg/contracts';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/u, '');

export type ReportStatusLookupFailureKind =
  | 'network'
  | 'invalid-credential'
  | 'rate-limited'
  | 'unavailable'
  | 'http'
  | 'invalid-response';

export class ReportStatusLookupError extends Error {
  constructor(
    public readonly kind: ReportStatusLookupFailureKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ReportStatusLookupError';
  }
}

export async function lookupPrivateReportStatus(
  request: ReportStatusLookupRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<ReportStatusLookupResponse> {
  const parsedRequest = ReportStatusLookupRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw new ReportStatusLookupError('invalid-credential', 'Enter a valid report ID and recovery key.');
  }

  let response: Response;
  try {
    response = await fetchImplementation(`${API_BASE_URL}/reports/status`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(parsedRequest.data),
    });
  } catch {
    throw new ReportStatusLookupError('network', 'Report status is unavailable offline. Try again when connected.');
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 404) {
      throw new ReportStatusLookupError(
        'invalid-credential',
        'The report ID and recovery key could not be matched.',
        response.status,
      );
    }
    if (response.status === 429) {
      throw new ReportStatusLookupError('rate-limited', 'Too many attempts. Wait before trying again.', response.status);
    }
    if (response.status >= 500) {
      throw new ReportStatusLookupError('unavailable', 'The report status service is temporarily unavailable.', response.status);
    }
    throw new ReportStatusLookupError('http', 'Report status could not be checked.', response.status);
  }

  const parsedResponse = ReportStatusLookupResponseSchema.safeParse(payload);
  if (!parsedResponse.success) {
    throw new ReportStatusLookupError('invalid-response', 'The report status service returned an invalid response.');
  }
  if (parsedResponse.data.reportId !== parsedRequest.data.reportId) {
    throw new ReportStatusLookupError('invalid-response', 'The report status service returned an invalid response.');
  }
  return parsedResponse.data;
}

export function isReportStatusLookupError(error: unknown): error is ReportStatusLookupError {
  return error instanceof ReportStatusLookupError;
}
