import assert from 'node:assert/strict';
import test from 'node:test';

import { ANALYSIS_RULE_VERSION } from '@vbyg/contracts';

import { analyseOfferDraft } from './api';

const emptyAnalysis = {
  analysisId: 'analysis-0123456789abcdef',
  ruleVersion: ANALYSIS_RULE_VERSION,
  observedSignalCount: 0,
  checkedRuleCount: 9 as const,
  findings: [],
  markedPassages: [],
  unknownInformation: ['The employer identity remains unverified.'],
  safetyStatement:
    'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.' as const,
};

test('frontend sends transient fields but never uploads the selected screenshot', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  let requestUrl = '';
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(emptyAnalysis), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await analyseOfferDraft({
      text: '  A recruitment posting  ',
      link: ' https://example.org/job ',
      screenshot: { uri: 'file:///private/sensitive-image.jpg', width: 900, height: 1200 },
      saveRecentMetadata: false,
    });
    assert.equal(requestUrl, 'http://localhost:4000/api/v1/checks/analyse');
    assert.deepEqual(requestBody, {
      postingText: 'A recruitment posting',
      recruitmentLink: 'https://example.org/job',
      screenshotProvided: true,
    });
    assert.equal(JSON.stringify(requestBody).includes('sensitive-image'), false);
    assert.equal(result.observedSignalCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend exposes the API validation message without fabricating a result', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'VALIDATION_ERROR', message: 'The submitted information is invalid.', requestId: 'request-1' },
  }), { status: 400, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(
      () => analyseOfferDraft({ text: '', link: '', saveRecentMetadata: false }),
      /submitted information is invalid/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend forwards AbortSignal and preserves cancellation instead of reporting a service error', async () => {
  const originalFetch = globalThis.fetch;
  let capturedSignal: AbortSignal | null | undefined;
  globalThis.fetch = async (_input, init) => {
    capturedSignal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  };
  try {
    const controller = new AbortController();
    const request = analyseOfferDraft(
      { text: 'Posting text', link: '', saveRecentMetadata: false },
      { signal: controller.signal },
    );
    controller.abort();
    await assert.rejects(request, (error: unknown) => error instanceof Error && error.name === 'AbortError');
    assert.equal(capturedSignal, controller.signal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend rejects an invalid success response instead of navigating with fabricated analysis', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ observedSignalCount: 7 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  try {
    await assert.rejects(
      () => analyseOfferDraft({ text: 'Posting text', link: '', saveRecentMetadata: false }),
      /unexpected response/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
