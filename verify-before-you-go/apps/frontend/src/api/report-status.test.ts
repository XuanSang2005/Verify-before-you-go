import assert from 'node:assert/strict';
import test from 'node:test';

import { lookupPrivateReportStatus, ReportStatusLookupError } from './report-status';

const request = {
  reportId: 'R-23456789ABCDEFGH',
  recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST',
} as const;

const response = {
  reportId: request.reportId,
  submittedAt: '2026-08-12T09:00:00.000Z',
  status: 'under-review',
  updatedAt: '2026-08-12T10:00:00.000Z',
  nextStep: 'Keep the recovery key private and check again later.',
} as const;

test('status lookup posts a strict credential body with no-store and accepts a safe response', async () => {
  const requests: { input: string; init?: RequestInit }[] = [];
  const result = await lookupPrivateReportStatus(request, async (input, init) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify(response), { status: 200 });
  });
  assert.deepEqual(result, response);
  assert.match(requests[0]?.input ?? '', /\/reports\/status$/u);
  assert.equal(requests[0]?.init?.method, 'POST');
  assert.equal(requests[0]?.init?.cache, 'no-store');
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), request);
});

test('status lookup rejects invalid input before network and fails closed on mismatched response', async () => {
  let calls = 0;
  await assert.rejects(
    lookupPrivateReportStatus({ ...request, recoveryKey: 'wrong' }, async () => {
      calls += 1;
      return new Response();
    }),
    (error: unknown) => error instanceof ReportStatusLookupError && error.kind === 'invalid-credential',
  );
  assert.equal(calls, 0);

  await assert.rejects(
    lookupPrivateReportStatus(request, async () => new Response(JSON.stringify({
      ...response,
      reportId: 'R-23456789ABCDEFGJ',
    }), { status: 200 })),
    (error: unknown) => error instanceof ReportStatusLookupError && error.kind === 'invalid-response',
  );
});

test('status lookup maps connection, indistinguishable credential and availability failures', async () => {
  await assert.rejects(
    lookupPrivateReportStatus(request, async () => { throw new Error('secret transport detail'); }),
    (error: unknown) => error instanceof ReportStatusLookupError
      && error.kind === 'network'
      && !error.message.includes(request.recoveryKey),
  );
  await assert.rejects(
    lookupPrivateReportStatus(request, async () => new Response('{}', { status: 404 })),
    (error: unknown) => error instanceof ReportStatusLookupError && error.kind === 'invalid-credential',
  );
  await assert.rejects(
    lookupPrivateReportStatus(request, async () => new Response('{}', { status: 503 })),
    (error: unknown) => error instanceof ReportStatusLookupError && error.kind === 'unavailable',
  );
});
