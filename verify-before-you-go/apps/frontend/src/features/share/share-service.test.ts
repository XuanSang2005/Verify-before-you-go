import assert from 'node:assert/strict';
import test from 'node:test';

import { createSafeShareSummary } from './share-model';
import {
  copyPrivateSummary,
  createPrivateShareBundle,
  sharePrivateSummary,
  type PrivateShareAdapters,
} from './share-service';

const bundle = createPrivateShareBundle(
  createSafeShareSummary(undefined, Date.UTC(2026, 7, 11)),
  'https://example.test/share/recipient?v=1&signals=none',
);

function adapters(overrides: Partial<PrivateShareAdapters> = {}): PrivateShareAdapters {
  return {
    platform: 'web',
    nativeShare: async () => ({ action: 'sharedAction' }),
    copy: async () => undefined,
    ...overrides,
  };
}

test('uses Web Share when available without invoking the clipboard fallback', async () => {
  const calls: string[] = [];
  const result = await sharePrivateSummary(bundle, adapters({
    webShare: async (data) => { calls.push(`share:${data.url}`); },
    copy: async () => { calls.push('copy'); },
  }));
  assert.equal(result, 'shared');
  assert.deepEqual(calls, [`share:${bundle.url}`]);
});

test('uses the copy fallback when Web Share is unavailable', async () => {
  let copied = '';
  const result = await sharePrivateSummary(bundle, adapters({
    copy: async (value) => { copied = value; },
  }));
  assert.equal(result, 'copied');
  assert.match(copied, /not a verdict/i);
  assert.match(copied, new RegExp(bundle.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('opens the native share sheet with the recipient link', async () => {
  let shared: { message: string; url?: string } | undefined;
  const result = await sharePrivateSummary(bundle, adapters({
    platform: 'ios',
    nativeShare: async (content) => {
      shared = content;
      return { action: 'sharedAction' };
    },
  }));
  assert.equal(result, 'shared');
  assert.equal(shared?.url, bundle.url);
  assert.match(shared?.message ?? '', /Full identifiers and the original screenshot are hidden/);
});

test('treats a Web Share cancellation as dismissed and propagates other failures', async () => {
  const aborted = new Error('cancelled');
  aborted.name = 'AbortError';
  assert.equal(await sharePrivateSummary(bundle, adapters({ webShare: async () => { throw aborted; } })), 'dismissed');
  await assert.rejects(
    () => sharePrivateSummary(bundle, adapters({ webShare: async () => { throw new Error('denied'); } })),
    /denied/,
  );
});

test('copies the same privacy-safe text and recipient link from the explicit control', async () => {
  let copied = '';
  await copyPrivateSummary(bundle, async (value) => { copied = value; });
  assert.equal(copied, `${bundle.text}\n\n${bundle.url}`);
});
