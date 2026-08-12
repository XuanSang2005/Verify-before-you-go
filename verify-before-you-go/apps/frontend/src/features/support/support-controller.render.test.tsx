import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { SupportDirectoryResponse } from '@vbyg/contracts';

import {
  commitStagedSupportDirectoryIfAuthoritative,
  loadCachedSupportDirectory,
  stageCachedSupportDirectory,
  type SupportCacheStoragePort,
} from './support-cache';
import { SupportDirectoryCoordinator } from './support-coordinator';
import {
  useSupportDirectory,
  type SupportDirectoryDependencies,
} from './use-support-directory';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const oldDirectory: SupportDirectoryResponse = {
  schemaVersion: 1,
  contacts: [],
  fetchedAt: '2026-08-12T00:00:00.000Z',
  directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
};

const newDirectory: SupportDirectoryResponse = {
  ...oldDirectory,
  fetchedAt: '2026-08-13T00:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function createStorage(): SupportCacheStoragePort {
  const values = new Map<string, string>();
  return {
    getAllKeys: async () => [...values.keys()],
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => { values.delete(key); },
    setItem: async (key, value) => { values.set(key, value); },
  };
}

let activeRoot: Root | undefined;
let activeContainer: HTMLDivElement | undefined;

afterEach(async () => {
  if (activeRoot) await act(async () => activeRoot?.unmount());
  activeContainer?.remove();
  activeRoot = undefined;
  activeContainer = undefined;
});

async function waitUntil(predicate: () => boolean) {
  for (let index = 0; index < 40; index += 1) {
    if (predicate()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
  throw new Error('Rendered support controller did not reach the expected state.');
}

function Harness({ dependencies }: { dependencies: SupportDirectoryDependencies }) {
  const directory = useSupportDirectory(dependencies);
  return (
    <div>
      <output data-testid="status">{directory.status}</output>
      <output data-testid="revision">{directory.response?.fetchedAt ?? ''}</output>
      <output data-testid="storage-message">{directory.storageMessage ?? ''}</output>
      <button
        data-testid="save"
        disabled={Boolean(directory.savingOffline || directory.refreshing)}
        onClick={() => void directory.saveOffline()}
        type="button"
      >
        {directory.savingOffline ? 'Saving…' : 'Save offline'}
      </button>
      <button data-testid="retry" onClick={directory.retry} type="button">Retry</button>
    </div>
  );
}

describe('support controller cache authority', () => {
  it('new refresh supersedes an entered manual candidate and clears Saving honestly', async () => {
    const storage = createStorage();
    const coordinator = new SupportDirectoryCoordinator();
    const manualGate = deferred<void>();
    let fetchCount = 0;
    let stageCount = 0;
    let manualEntered = false;
    const dependencies: SupportDirectoryDependencies = {
      coordinator,
      fetchDirectory: async () => {
        fetchCount += 1;
        return fetchCount === 1 ? oldDirectory : newDirectory;
      },
      loadCache: () => loadCachedSupportDirectory(storage),
      stageCache: async (value) => {
        stageCount += 1;
        const candidate = await stageCachedSupportDirectory(
          value,
          storage,
          undefined,
          `rendered-${stageCount}`,
        );
        if (stageCount === 2) {
          manualEntered = true;
          await manualGate.promise;
        }
        return candidate;
      },
      commitCache: (candidate, isAuthoritative) => commitStagedSupportDirectoryIfAuthoritative(
        candidate,
        isAuthoritative,
        storage,
      ),
    };

    activeContainer = document.createElement('div');
    document.body.appendChild(activeContainer);
    activeRoot = createRoot(activeContainer);
    await act(async () => activeRoot?.render(<Harness dependencies={dependencies} />));
    await waitUntil(() => activeContainer?.querySelector('[data-testid="status"]')?.textContent === 'empty');

    const save = activeContainer.querySelector<HTMLButtonElement>('[data-testid="save"]');
    const retry = activeContainer.querySelector<HTMLButtonElement>('[data-testid="retry"]');
    if (!save || !retry) throw new Error('Support controller controls did not render.');
    await act(async () => save.click());
    await waitUntil(() => manualEntered);
    expect(save.disabled).toBe(true);
    expect(save.textContent).toBe('Saving…');

    await act(async () => retry.click());
    await waitUntil(() => activeContainer?.querySelector('[data-testid="revision"]')?.textContent === newDirectory.fetchedAt);
    manualGate.resolve();
    await waitUntil(() => activeContainer?.querySelector('[data-testid="storage-message"]')?.textContent.includes('newer directory update') ?? false);

    expect(activeContainer.querySelector('[data-testid="status"]')?.textContent).toBe('empty');
    expect(save.disabled).toBe(false);
    expect(save.textContent).toBe('Save offline');
    expect((await loadCachedSupportDirectory(storage))?.data.fetchedAt).toBe(newDirectory.fetchedAt);
  });
});
