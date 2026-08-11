import {
  ApiErrorSchema,
  ShareSummaryRequestSchema,
  ShareTokenCreationResponseSchema,
  ShareTokenVerificationRequestSchema,
  ShareTokenVerificationResponseSchema,
  type ShareSummaryRequest,
  type ShareTokenCreationResponse,
  type ShareTokenVerificationResponse,
} from '@vbyg/contracts';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/u, '');

export type ShareTokenFailureKind = 'network' | 'http' | 'invalid-response';

export class ShareTokenApiError extends Error {
  constructor(
    public readonly kind: ShareTokenFailureKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ShareTokenApiError';
  }
}

export async function createSignedShareToken(
  summary: ShareSummaryRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<ShareTokenCreationResponse> {
  return requestShareToken(
    '/share-tokens',
    ShareSummaryRequestSchema.parse(summary),
    ShareTokenCreationResponseSchema,
    fetchImplementation,
    201,
  );
}

export async function verifySignedShareToken(
  token: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ShareTokenVerificationResponse> {
  return requestShareToken(
    '/share-tokens/verify',
    ShareTokenVerificationRequestSchema.parse({ token }),
    ShareTokenVerificationResponseSchema,
    fetchImplementation,
    200,
  );
}

async function requestShareToken<T>(
  path: string,
  body: ShareSummaryRequest | { token: string },
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  fetchImplementation: typeof fetch,
  expectedStatus: number,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImplementation(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ShareTokenApiError('network', 'The recipient link service could not be reached.');
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok || response.status !== expectedStatus) {
    const error = ApiErrorSchema.safeParse(payload);
    throw new ShareTokenApiError(
      'http',
      error.success ? error.data.error.message : 'The recipient link could not be processed.',
      response.status,
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ShareTokenApiError('invalid-response', 'The recipient link service returned an invalid response.');
  }
  return parsed.data;
}
