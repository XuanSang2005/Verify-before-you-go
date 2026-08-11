import {
  AlertDetailResponseSchema,
  AlertListResponseSchema,
  ApiErrorSchema,
  type AlertDetailResponse,
  type AlertListQuery,
  type AlertListResponse,
} from '@vbyg/contracts';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export type AlertsFetch = typeof fetch;
export type AlertsApiErrorKind = 'network' | 'http' | 'invalid-response';

export class AlertsApiError extends Error {
  readonly kind: AlertsApiErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor({
    code,
    kind,
    message,
    status,
  }: {
    code?: string;
    kind: AlertsApiErrorKind;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = 'AlertsApiError';
    this.code = code;
    this.kind = kind;
    this.status = status;
  }
}

export function isAlertsApiError(error: unknown): error is AlertsApiError {
  return error instanceof AlertsApiError;
}

async function parseAlertsResponse<T>(
  response: Response,
  schema: { safeParse: (payload: unknown) => { success: true; data: T } | { success: false } },
): Promise<T> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload);
    throw new AlertsApiError({
      code: apiError.success ? apiError.data.error.code : undefined,
      kind: 'http',
      message: apiError.success
        ? apiError.data.error.message
        : 'The community alerts service could not process this request.',
      status: response.status,
    });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AlertsApiError({
      kind: 'invalid-response',
      message: 'The community alerts service returned an unexpected response.',
    });
  }
  return parsed.data;
}

function buildAlertListQuery(query: AlertListQuery): string {
  const values: string[] = [];
  if (query.search) values.push(`search=${encodeURIComponent(query.search)}`);
  if (query.location) values.push(`location=${encodeURIComponent(query.location)}`);
  if (query.category) values.push(`category=${encodeURIComponent(query.category)}`);
  return values.length ? `?${values.join('&')}` : '';
}

export async function fetchCommunityAlerts(
  query: AlertListQuery = {},
  fetchImpl: AlertsFetch = fetch,
): Promise<AlertListResponse> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/alerts${buildAlertListQuery(query)}`);
  } catch {
    throw new AlertsApiError({
      kind: 'network',
      message: 'Community alerts could not be reached. Check your connection and try again.',
    });
  }
  return parseAlertsResponse(response, AlertListResponseSchema);
}

export async function fetchCommunityAlert(
  id: string,
  fetchImpl: AlertsFetch = fetch,
): Promise<AlertDetailResponse> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/alerts/${encodeURIComponent(id)}`);
  } catch {
    throw new AlertsApiError({
      kind: 'network',
      message: 'This community alert could not be reached. Check your connection and try again.',
    });
  }
  return parseAlertsResponse(response, AlertDetailResponseSchema);
}
