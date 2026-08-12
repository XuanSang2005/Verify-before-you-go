import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import { SupportApiError } from '@/api/support';

import {
  loadSupportDirectoryState,
  type SupportDirectoryDependencies,
} from './use-support-directory';

const directory: SupportDirectoryResponse = {
  schemaVersion: 1,
  contacts: [],
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
};

function dependencies(overrides: Partial<SupportDirectoryDependencies> = {}): SupportDirectoryDependencies {
  return {
    fetchDirectory: async () => directory,
    loadCache: async () => null,
    saveCache: async () => undefined,
    ...overrides,
  };
}

function apiError(kind: 'network' | 'http' | 'invalid-response', status?: number) {
  return new SupportApiError({ kind, message: `${kind} failure`, status });
}

test('successful support fetch updates the offline cache without storing private input', async () => {
  let saved: SupportDirectoryResponse | undefined;
  const state = await loadSupportDirectoryState(dependencies({
    saveCache: async (value) => { saved = value; },
  }));
  assert.equal(state.status, 'empty');
  assert.equal(state.savedOffline, true);
  assert.equal(saved?.schemaVersion, 1);
});

test('network failure uses saved support contacts with an explicit offline disclosure', async () => {
  const state = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('network'); },
    loadCache: async () => ({ schemaVersion: 1, cachedAt: '2026-08-12T01:00:00.000Z', data: directory }),
  }));
  assert.equal(state.status, 'offline');
  assert.equal(state.message, 'Offline · showing saved contacts');
  assert.equal(state.cachedAt, '2026-08-12T01:00:00.000Z');
});

test('HTTP 500 with cache is service unavailable, while invalid data fails closed', async () => {
  const cached = async () => ({ schemaVersion: 1 as const, cachedAt: '2026-08-12T01:00:00.000Z', data: directory });
  const unavailable = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('http', 500); },
    loadCache: cached,
  }));
  assert.equal(unavailable.status, 'service-unavailable');

  const invalid = await loadSupportDirectoryState(dependencies({
    fetchDirectory: async () => { throw apiError('invalid-response'); },
    loadCache: cached,
  }));
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.response, undefined);
});

test('cache write failure keeps live data visible with an honest storage warning', async () => {
  const state = await loadSupportDirectoryState(dependencies({
    saveCache: async () => { throw new Error('disk full'); },
  }));
  assert.equal(state.status, 'empty');
  assert.equal(state.savedOffline, false);
  assert.match(state.storageMessage ?? '', /could not update/i);
});
