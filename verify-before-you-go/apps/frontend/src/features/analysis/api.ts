import {
  AnalyseOfferResponseSchema,
  ApiErrorSchema,
  type AnalyseOfferRequest,
  type AnalyseOfferResponse,
} from '@vbyg/contracts';

import type { OfferDraft } from '@/features/offer-intake/model';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export interface AnalyseOfferDraftOptions {
  signal?: AbortSignal;
}

export async function analyseOfferDraft(
  draft: OfferDraft,
  options: AnalyseOfferDraftOptions = {},
): Promise<AnalyseOfferResponse> {
  const request: AnalyseOfferRequest = {
    ...(draft.text.trim() ? { postingText: draft.text.trim() } : {}),
    ...(draft.link.trim() ? { recruitmentLink: draft.link.trim() } : {}),
    screenshotProvided: Boolean(draft.screenshot),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/checks/analyse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) throw error;
    throw new Error('The local analysis service could not be reached. Confirm the backend is running and try again.');
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(payload);
    throw new Error(apiError.success ? apiError.data.error.message : 'The local analysis service could not process this posting.');
  }
  const parsed = AnalyseOfferResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('The local analysis service returned an unexpected response. No conclusion was produced.');
  }
  return parsed.data;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
