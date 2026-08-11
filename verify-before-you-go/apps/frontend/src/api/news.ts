import {
  ApiErrorSchema,
  NewsDetailResponseSchema,
  NewsListResponseSchema,
  type NewsCategory,
  type NewsDetailResponse,
  type NewsListResponse,
} from '@vbyg/contracts';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export type NewsFetch = typeof fetch;

export type NewsApiErrorKind = 'network' | 'http' | 'invalid-response';

export class NewsApiError extends Error {
  readonly kind: NewsApiErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor({
    code,
    kind,
    message,
    status,
  }: {
    code?: string;
    kind: NewsApiErrorKind;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = 'NewsApiError';
    this.code = code;
    this.kind = kind;
    this.status = status;
  }
}

export function isNewsApiError(error: unknown): error is NewsApiError {
  return error instanceof NewsApiError;
}

async function parseNewsResponse<T>(
  response: Response,
  schema: { safeParse: (payload: unknown) => { success: true; data: T } | { success: false } },
): Promise<T> {
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload);
    throw new NewsApiError({
      code: apiError.success ? apiError.data.error.code : undefined,
      kind: 'http',
      message: apiError.success ? apiError.data.error.message : 'The newsroom service could not process this request.',
      status: response.status,
    });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new NewsApiError({
      kind: 'invalid-response',
      message: 'The newsroom service returned an unexpected response.',
    });
  }
  return parsed.data;
}

export async function fetchNewsStories(
  category?: NewsCategory,
  fetchImpl: NewsFetch = fetch,
): Promise<NewsListResponse> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/news${query}`);
  } catch {
    throw new NewsApiError({
      kind: 'network',
      message: 'The newsroom could not be reached. Check your connection and try again.',
    });
  }
  return parseNewsResponse(response, NewsListResponseSchema);
}

export async function fetchNewsStory(
  slug: string,
  fetchImpl: NewsFetch = fetch,
): Promise<NewsDetailResponse> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/news/${encodeURIComponent(slug)}`);
  } catch {
    throw new NewsApiError({
      kind: 'network',
      message: 'This newsroom story could not be reached. Check your connection and try again.',
    });
  }
  return parseNewsResponse(response, NewsDetailResponseSchema);
}
