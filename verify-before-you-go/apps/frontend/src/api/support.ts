import {
  ApiErrorSchema,
  SupportDirectoryResponseSchema,
  type SupportCountry,
  type SupportDirectoryResponse,
} from '@vbyg/contracts';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export type SupportFetch = typeof fetch;
export type SupportApiErrorKind = 'network' | 'http' | 'invalid-response';

export class SupportApiError extends Error {
  readonly kind: SupportApiErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor({
    code,
    kind,
    message,
    status,
  }: {
    code?: string;
    kind: SupportApiErrorKind;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = 'SupportApiError';
    this.code = code;
    this.kind = kind;
    this.status = status;
  }
}

export function isSupportApiError(error: unknown): error is SupportApiError {
  return error instanceof SupportApiError;
}

export async function fetchSupportDirectory(
  country?: SupportCountry,
  fetchImpl: SupportFetch = fetch,
): Promise<SupportDirectoryResponse> {
  const query = country ? `?country=${encodeURIComponent(country)}` : '';
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/support-contacts${query}`);
  } catch {
    throw new SupportApiError({
      kind: 'network',
      message: 'The support directory could not be reached. Check your connection and try again.',
    });
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload);
    throw new SupportApiError({
      code: apiError.success ? apiError.data.error.code : undefined,
      kind: 'http',
      message: apiError.success
        ? apiError.data.error.message
        : 'The support directory could not process this request.',
      status: response.status,
    });
  }

  const parsed = SupportDirectoryResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SupportApiError({
      kind: 'invalid-response',
      message: 'The support directory returned an unexpected response.',
    });
  }
  return parsed.data;
}
