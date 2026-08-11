import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRecentCheckMetadata, parseRecentChecks } from './recent-model';

test('recent activity stores metadata but no offer content or local image URI', () => {
  const item = buildRecentCheckMetadata(
    {
      text: 'Private offer text',
      link: 'https://private.example/job',
      screenshot: { uri: 'file:///private/screenshot.png', width: 100, height: 200 },
      saveRecentMetadata: true,
    },
    'recent-1',
    '2026-08-09T08:00:00.000Z',
  );
  const serialized = JSON.stringify(item);
  assert.deepEqual(item.inputKinds, ['text', 'link', 'screenshot']);
  assert.equal(serialized.includes('Private offer text'), false);
  assert.equal(serialized.includes('private.example'), false);
  assert.equal(serialized.includes('screenshot.png'), false);
});

test('parses only valid recent metadata and strips unexpected properties', () => {
  const parsed = parseRecentChecks(JSON.stringify([
    {
      id: 'recent-1',
      savedAt: '2026-08-09T08:00:00.000Z',
      inputKinds: ['text'],
      text: 'must not survive parsing',
    },
    { id: 3, savedAt: null, inputKinds: ['unknown'] },
  ]));
  assert.deepEqual(parsed, [{ id: 'recent-1', savedAt: '2026-08-09T08:00:00.000Z', inputKinds: ['text'] }]);
});
