import assert from 'node:assert/strict';
import test from 'node:test';

import { HealthResponseSchema } from './common.js';

test('health contract accepts the documented response', () => {
  const parsed = HealthResponseSchema.parse({
    status: 'ok',
    service: 'verify-before-you-go-backend',
    database: 'connected',
    timestamp: '2026-08-09T05:00:00.000Z',
  });
  assert.equal(parsed.status, 'ok');
});
