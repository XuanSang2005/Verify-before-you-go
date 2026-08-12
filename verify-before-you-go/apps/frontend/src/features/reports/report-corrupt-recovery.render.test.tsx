import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from 'expo-router';
import { describe, expect, it, vi } from 'vitest';

import { ReportDraftProvider, useReportDraft } from './ReportDraftContext';
import { ReportPrivacyScreen } from './ReportPrivacyScreen';
import { ReportSubmissionProvider } from './ReportSubmissionContext';
import { InvalidReportSubmissionAttemptError, type ReportSubmissionAttemptStoragePort } from './report-submission-attempt-storage';
import { ReportSubmissionCoordinator } from './report-submission-coordinator';
import { createEmptyReportDraft, toggleReportBehaviour, updateReportDraft, type ReportDraft } from './report-model';
import type { ReportEvidenceLifecyclePort } from './report-evidence-lifecycle';
import type { ReportDraftPersistencePort, ReportDraftWriteResult } from './report-persistence-coordinator';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-router', () => ({
  router: { back: vi.fn(), canGoBack: vi.fn(() => true), push: vi.fn(), replace: vi.fn() },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function validDraft(): ReportDraft {
  return updateReportDraft(
    toggleReportBehaviour(createEmptyReportDraft('2026-08-11T08:00:00.000Z'), 'pressure'),
    {
      evidence: [{
        addedAt: '2026-08-11T08:01:00.000Z',
        fileName: 'private-evidence.png',
        id: 'private-evidence',
        mimeType: 'image/png',
        uri: 'file:///private/private-evidence.png',
      }],
      identifier: '@private_recruiter',
      identifierType: 'handle',
    },
  );
}

describe('CP11 corrupt submission recovery controller', () => {
  it('requires confirmation then clears the attempt, draft and evidence lifecycle before opening a usable new report', async () => {
    vi.mocked(router.replace).mockClear();
    const writes: ReportDraft[] = [];
    const reconciled: ReportDraft[] = [];
    let revision = 0;
    const persistence: ReportDraftPersistencePort = {
      async enqueue(draft) {
        writes.push(draft);
        revision += 1;
        return { isLatest: true, revision, status: 'saved' } satisfies ReportDraftWriteResult;
      },
      async hydrate() {
        return { draft: validDraft(), status: 'valid' };
      },
      subscribe: () => () => undefined,
      whenIdle: async () => undefined,
    };
    const evidenceLifecycle: ReportEvidenceLifecyclePort = {
      add: async (draft) => ({ draft }),
      remove: async (draft) => ({ draft }),
      async reconcile(draft) {
        reconciled.push(draft);
        return { draft };
      },
      whenIdle: async () => undefined,
    };
    let attemptClears = 0;
    const attemptStorage: ReportSubmissionAttemptStoragePort = {
      load: async () => { throw new InvalidReportSubmissionAttemptError(); },
      save: async () => undefined,
      clear: async () => { attemptClears += 1; },
    };
    let apiCalls = 0;
    const coordinator = new ReportSubmissionCoordinator(attemptStorage, {
      createIdempotencyKey: async () => 'corrupt_recovery_test_key_1234',
      fingerprint: async () => 'a'.repeat(64),
      now: () => new Date('2026-08-11T10:00:00.000Z'),
      retain: async () => ({ status: 'shown-once-web', message: 'Shown once.' }),
      submit: async () => {
        apiCalls += 1;
        throw new Error('must not reach API');
      },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ReportDraftProvider evidenceLifecycle={evidenceLifecycle} persistence={persistence}>
          <ReportSubmissionProvider coordinator={coordinator}>
            <ReportPrivacyScreen />
          </ReportSubmissionProvider>
        </ReportDraftProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const submit = container.querySelector<HTMLElement>('[data-testid="report-submit-private"]');
    expect(submit).toBeTruthy();
    await act(async () => {
      submit?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiCalls).toBe(0);
    expect(container.textContent).toContain('Submission recovery required');

    await act(async () => container.querySelector<HTMLElement>('[data-testid="report-review-corrupt-recovery"]')?.click());
    expect(attemptClears).toBe(0);
    await act(async () => {
      container.querySelector<HTMLElement>('[data-testid="report-confirm-corrupt-recovery"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(attemptClears).toBe(1);
    expect(writes.at(-1)?.evidence).toEqual([]);
    expect(reconciled.at(-1)?.evidence).toEqual([]);
    expect(vi.mocked(router.replace)).toHaveBeenCalledWith('/reports/new');

    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps the cleared draft authoritative when an older hydration resolves after corrupt reset', async () => {
    const staleDraft = validDraft();
    let resolveHydration!: (value: { draft: ReportDraft; status: 'valid' }) => void;
    const hydration = new Promise<{ draft: ReportDraft; status: 'valid' }>((resolve) => {
      resolveHydration = resolve;
    });
    const writes: ReportDraft[] = [];
    let revision = 0;
    const persistence: ReportDraftPersistencePort = {
      async enqueue(draft) {
        writes.push(draft);
        revision += 1;
        return { isLatest: true, revision, status: 'saved' };
      },
      hydrate: async () => hydration,
      subscribe: () => () => undefined,
      whenIdle: async () => undefined,
    };
    const evidenceLifecycle: ReportEvidenceLifecyclePort = {
      add: async (draft) => ({ draft }),
      remove: async (draft) => ({ draft }),
      reconcile: async (draft) => ({ draft }),
      whenIdle: async () => undefined,
    };

    function ContextProbe() {
      const report = useReportDraft();
      return (
        <div>
          <span data-testid="draft-identifier">{report.draft.identifier || 'empty'}</span>
          <span data-testid="draft-storage-issue">{report.storageIssue?.message}</span>
          <button data-testid="clear-draft" onClick={() => void report.clearForNewReport()} type="button">Clear</button>
        </div>
      );
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ReportDraftProvider evidenceLifecycle={evidenceLifecycle} persistence={persistence}>
          <ContextProbe />
        </ReportDraftProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector<HTMLElement>('[data-testid="clear-draft"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writes.at(-1)?.identifier).toBe('');

    await act(async () => {
      resolveHydration({ draft: staleDraft, status: 'valid' });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="draft-identifier"]')?.textContent).toBe('empty');
    expect(container.querySelector('[data-testid="draft-storage-issue"]')?.textContent).toBe('');
    expect(writes.at(-1)?.identifier).toBe('');

    await act(async () => root.unmount());
    container.remove();
  });
});
