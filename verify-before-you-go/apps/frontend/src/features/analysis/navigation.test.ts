import assert from 'node:assert/strict';
import test from 'node:test';

import { analysisActionRoutes, legacyShareRoute } from './navigation';

test('uses the canonical post-analysis routes and checkpoint labels', () => {
  assert.deepEqual(analysisActionRoutes, {
    checklist: { route: '/check/checklist', checkpoint: 'CP05' },
    report: { route: '/reports/new', checkpoint: 'CP10' },
    share: { route: '/share/preview', checkpoint: 'CP12' },
  });
  assert.equal(legacyShareRoute, '/check/share');
  assert.notEqual(analysisActionRoutes.share.route, legacyShareRoute);
});
