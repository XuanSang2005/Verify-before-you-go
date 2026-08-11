import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import {
  createEmptyReportDraft,
  hasReportDraftErrors,
  toggleReportBehaviour,
  updateReportDraft,
  validateReportDraftForPrivacy,
  type ReportDraft,
  type ReportDraftErrors,
} from './report-model';
import { ReportDraftExperience } from './ReportDraftScreen';
import { ReportPrivacyExperience } from './ReportPrivacyScreen';
import { ReportReceiptExperience } from './ReportReceiptScreen';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: { back: vi.fn(), canGoBack: vi.fn(() => true), push: vi.fn(), replace: vi.fn() },
}));

const clipboardSetStringAsync = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('expo-clipboard', () => ({
  setStringAsync: clipboardSetStringAsync,
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = {
  container: HTMLDivElement;
  reviewCalls: () => number;
  root: Root;
  saveCalls: () => number;
};

function validDraft(): ReportDraft {
  return updateReportDraft(
    toggleReportBehaviour(createEmptyReportDraft('2026-08-11T08:00:00.000Z'), 'identity-document-request'),
    {
      description: 'Contact @linh_hr_2026 and send passport no. AB1234567 before a contract.',
      identifier: '@linh_hr_2026',
      identifierType: 'handle',
    },
    '2026-08-11T08:01:00.000Z',
  );
}

function DraftHarness({ initialDraft = createEmptyReportDraft('2026-08-11T08:00:00.000Z'), onReview }: {
  initialDraft?: ReportDraft;
  onReview: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<ReportDraftErrors>({});
  const update = (updater: (current: ReportDraft) => ReportDraft) => {
    setDraft(updater);
    setErrors({});
  };
  return (
    <ReportDraftExperience
      draft={draft}
      errors={errors}
      evidencePending={false}
      loading={false}
      onAddEvidence={() => update((current) => updateReportDraft(current, {
        evidence: [...current.evidence, {
          addedAt: '2026-08-11T08:02:00.000Z',
          fileName: 'conversation.png',
          fileSize: 125_000,
          id: 'evidence-1',
          mimeType: 'image/png',
          uri: 'file:///private/conversation.png',
        }],
      }))}
      onBack={() => undefined}
      onBehaviourToggle={(id) => update((current) => toggleReportBehaviour(current, id))}
      onDescriptionChange={(description) => update((current) => updateReportDraft(current, { description }))}
      onIdentifierChange={(identifier) => update((current) => updateReportDraft(current, { identifier }))}
      onIdentifierTypeChange={(identifierType) => update((current) => updateReportDraft(current, { identifierType }))}
      onRemoveEvidence={(id) => update((current) => updateReportDraft(current, {
        evidence: current.evidence.filter((item) => item.id !== id),
      }))}
      onRetryStorage={() => undefined}
      onReviewPrivacy={() => {
        const nextErrors = validateReportDraftForPrivacy(draft);
        setErrors(nextErrors);
        if (!hasReportDraftErrors(nextErrors)) onReview();
      }}
      onSubjectTypeChange={(subjectType) => update((current) => updateReportDraft(current, { subjectType }))}
      retryPending={false}
    />
  );
}

function PrivacyHarness({
  initialDraft = validDraft(),
  onSave,
  onSubmit = () => undefined,
  onRecover = () => undefined,
  submissionError,
  submissionPending = false,
  submissionRecoveryRequired = false,
}: {
  initialDraft?: ReportDraft;
  onSave: () => void;
  onSubmit?: () => void;
  onRecover?: () => void;
  submissionError?: string;
  submissionPending?: boolean;
  submissionRecoveryRequired?: boolean;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [recoveryRequired, setRecoveryRequired] = useState(submissionRecoveryRequired);
  return (
    <ReportPrivacyExperience
      draft={draft}
      loading={false}
      onBackToEdit={() => undefined}
      onPartnerNameChange={(namedPartner) => setDraft((current) => updateReportDraft(current, {
        permissions: { ...current.permissions, namedPartner },
      }))}
      onPermissionChange={(permission, value) => setDraft((current) => updateReportDraft(current, {
        permissions: { ...current.permissions, [permission]: value },
      }))}
      onRecoverCorruptReport={() => {
        onRecover();
        setDraft(createEmptyReportDraft('2026-08-11T11:00:00.000Z'));
        setRecoveryRequired(false);
      }}
      onPublicPreviewChange={(redactedPreview) => setDraft((current) => updateReportDraft(current, { redactedPreview }))}
      onRestoreSuggested={() => setDraft((current) => updateReportDraft(current, { redactedPreview: undefined }))}
      onSave={onSave}
      onSubmit={onSubmit}
      recoveryPending={false}
      savePending={false}
      submissionError={submissionError}
      submissionPending={submissionPending}
      submissionRecoveryRequired={recoveryRequired}
    />
  );
}

async function render(node: ReactNode, counters: { review?: () => number; save?: () => number } = {}): Promise<Harness> {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const container = document.createElement('div');
  container.style.width = '390px';
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return {
    container,
    reviewCalls: counters.review ?? (() => 0),
    root,
    saveCalls: counters.save ?? (() => 0),
  };
}

async function cleanup(harness: Harness) {
  await act(async () => harness.root.unmount());
  harness.container.remove();
}

function control(container: HTMLElement, testID: string): HTMLElement {
  const match = container.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!match) throw new Error(`${testID} was not rendered`);
  return match;
}

async function changeText(element: HTMLElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  await act(async () => element.dispatchEvent(new Event('input', { bubbles: true })));
}

async function keyDown(element: HTMLElement, key: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe('CP10 rendered report draft and privacy review', () => {
  it('requires an identifier and observed behaviour before opening privacy review', async () => {
    let reviews = 0;
    const harness = await render(<DraftHarness onReview={() => { reviews += 1; }} />, { review: () => reviews });
    await act(async () => control(harness.container, 'report-review-privacy').click());
    expect(harness.reviewCalls()).toBe(0);
    expect(harness.container.textContent).toContain('Add one searchable identifier or source location');
    expect(harness.container.textContent).toContain('Select at least one behaviour');

    await changeText(control(harness.container, 'report-identifier-input'), '@recruiter_demo');
    await act(async () => control(harness.container, 'report-behaviour-payment-request').click());
    expect(control(harness.container, 'report-behaviour-payment-request').getAttribute('aria-checked')).toBe('true');
    await act(async () => control(harness.container, 'report-review-privacy').click());
    expect(harness.reviewCalls()).toBe(1);
    await cleanup(harness);
  });

  it('adds and removes optional local evidence with a 48px remove target', async () => {
    const harness = await render(<DraftHarness onReview={() => undefined} initialDraft={validDraft()} />);
    await act(async () => control(harness.container, 'report-add-evidence').click());
    expect(control(harness.container, 'report-evidence-evidence-1').textContent).toContain('conversation.png');
    const remove = control(harness.container, 'report-remove-evidence-evidence-1');
    expect(remove.getAttribute('role')).toBe('button');
    expect(remove.getAttribute('aria-label')).toContain('Remove evidence');
    await act(async () => remove.click());
    expect(harness.container.querySelector('[data-testid="report-evidence-evidence-1"]')).toBeNull();
    await cleanup(harness);
  });

  it('uses one-tab-stop radiogroups with arrow, Home, End and Space keyboard selection', async () => {
    const harness = await render(<DraftHarness onReview={() => undefined} />);
    const jobPost = control(harness.container, 'report-subject-job-post');
    const recruiter = control(harness.container, 'report-subject-recruiter');
    const agency = control(harness.container, 'report-subject-agency');
    expect(jobPost.tabIndex).toBe(0);
    expect(recruiter.tabIndex).toBe(-1);

    await act(async () => jobPost.focus());
    await keyDown(jobPost, 'ArrowRight');
    expect(recruiter.getAttribute('aria-checked')).toBe('true');
    expect(recruiter.tabIndex).toBe(0);
    expect(document.activeElement).toBe(recruiter);

    await keyDown(recruiter, 'End');
    expect(agency.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(agency);
    await keyDown(agency, 'Home');
    expect(jobPost.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(jobPost);
    await keyDown(jobPost, 'ArrowUp');
    expect(agency.getAttribute('aria-checked')).toBe('true');

    const url = control(harness.container, 'report-identifier-type-url');
    const phone = control(harness.container, 'report-identifier-type-phone');
    await keyDown(url, 'ArrowDown');
    expect(phone.getAttribute('aria-checked')).toBe('true');
    await keyDown(phone, ' ');
    expect(phone.getAttribute('aria-checked')).toBe('true');
    await cleanup(harness);
  });

  it('toggles behaviour checkboxes and privacy switches with Space', async () => {
    const draftHarness = await render(<DraftHarness onReview={() => undefined} />);
    const behaviour = control(draftHarness.container, 'report-behaviour-pressure');
    expect(behaviour.getAttribute('aria-checked')).toBe('false');
    await keyDown(behaviour, ' ');
    expect(behaviour.getAttribute('aria-checked')).toBe('true');
    await keyDown(behaviour, ' ');
    expect(behaviour.getAttribute('aria-checked')).toBe('false');
    await cleanup(draftHarness);

    const privacyHarness = await render(<PrivacyHarness onSave={() => undefined} />);
    const permission = control(privacyHarness.container, 'report-permission-public-alert');
    expect(permission.getAttribute('aria-checked')).toBe('false');
    await keyDown(permission, ' ');
    expect(permission.getAttribute('aria-checked')).toBe('true');
    await cleanup(privacyHarness);
  });

  it('shows anonymous, private and non-verdict safety copy without a submit control', async () => {
    const harness = await render(<DraftHarness onReview={() => undefined} initialDraft={validDraft()} />);
    expect(harness.container.textContent).toContain('Anonymous by default');
    expect(harness.container.textContent).toContain('not a public accusation');
    expect(harness.container.textContent).toContain('Evidence is optional—not proof by itself.');
    expect(harness.container.textContent).not.toContain('Submit anonymously');
    await cleanup(harness);
  });

  it('renders protected original separately from a redacted editable derivative', async () => {
    const harness = await render(<PrivacyHarness onSave={() => undefined} />);
    expect(harness.container.textContent).toContain('@linh_hr_2026');
    const publicPreview = control(harness.container, 'report-public-preview-input') as HTMLTextAreaElement;
    expect(publicPreview.value).toContain('••••2026');
    expect(publicPreview.value).not.toContain('@linh_hr_2026');
    expect(publicPreview.value).not.toContain('AB1234567');
    expect(harness.container.textContent).toContain('server-side redaction must run again');
    await cleanup(harness);
  });

  it('uses granular switch semantics with optional public and partner sharing off by default', async () => {
    const harness = await render(<PrivacyHarness onSave={() => undefined} />);
    expect(control(harness.container, 'report-permission-private-matching').getAttribute('aria-checked')).toBe('true');
    expect(control(harness.container, 'report-permission-public-alert').getAttribute('aria-checked')).toBe('false');
    const partner = control(harness.container, 'report-permission-partner');
    expect(partner.getAttribute('aria-checked')).toBe('false');
    await act(async () => partner.click());
    expect(control(harness.container, 'report-permission-partner').getAttribute('aria-checked')).toBe('true');
    expect(control(harness.container, 'report-partner-name')).toBeTruthy();
    await changeText(control(harness.container, 'report-partner-name'), 'Support partner');
    await act(async () => partner.click());
    expect(control(harness.container, 'report-permission-partner').getAttribute('aria-checked')).toBe('false');
    await act(async () => partner.click());
    expect((control(harness.container, 'report-partner-name') as HTMLInputElement).value).toBe('');
    await cleanup(harness);
  });

  it('keeps a separate local-draft save action and discloses the structured submission boundary', async () => {
    let saves = 0;
    const harness = await render(<PrivacyHarness onSave={() => { saves += 1; }} />, { save: () => saves });
    await act(async () => control(harness.container, 'report-save-private-draft').click());
    expect(harness.saveCalls()).toBe(1);
    expect(harness.container.textContent).toContain('Local evidence images stay on this device');
    expect(control(harness.container, 'report-submit-private')).toBeTruthy();
    expect(harness.container.textContent).not.toContain('Submit anonymously');
    await cleanup(harness);
  });

  it('direct privacy entry without a usable draft returns to the edit state', async () => {
    const harness = await render(
      <PrivacyHarness initialDraft={createEmptyReportDraft('2026-08-11T08:00:00.000Z')} onSave={() => undefined} />,
    );
    expect(control(harness.container, 'report-privacy-incomplete').textContent).toContain('Finish the report details first.');
    expect(control(harness.container, 'report-privacy-return-to-edit')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="report-save-private-draft"]')).toBeNull();
    await cleanup(harness);
  });

  it('submits from privacy review, exposes a retry state, and disables duplicate taps while pending', async () => {
    let submits = 0;
    const ready = await render(
      <PrivacyHarness onSave={() => undefined} onSubmit={() => { submits += 1; }} />,
    );
    await act(async () => control(ready.container, 'report-submit-private').click());
    expect(submits).toBe(1);
    await cleanup(ready);

    const failed = await render(
      <PrivacyHarness
        onSave={() => undefined}
        onSubmit={() => undefined}
        submissionError="The private report service could not be reached. Your local draft is still available."
      />,
    );
    expect(control(failed.container, 'report-submission-error').textContent).toContain('Report not submitted');
    expect(control(failed.container, 'report-submit-private').textContent).toContain('Retry private submission');
    await cleanup(failed);

    const pending = await render(
      <PrivacyHarness onSave={() => undefined} submissionPending />,
    );
    expect(control(pending.container, 'report-submit-private').getAttribute('aria-disabled')).toBe('true');
    expect(control(pending.container, 'report-submit-private').textContent).toContain('Submitting private report');
    await cleanup(pending);
  });

  it('renders the real receipt hierarchy and copies the one-time recovery key', async () => {
    clipboardSetStringAsync.mockClear();
    const receipt = {
      report: {
        reportId: 'R-23456789ABCDEFGH' as const,
        submittedAt: '2026-08-11T10:00:00.000Z',
        status: 'received' as const,
        statusLabel: 'Received — not yet reviewed.' as const,
        privateIntakeNotice: 'This private receipt does not mean the report has been reviewed, verified or published.' as const,
      },
      recoveryKey: '2345-6789-ABCD-EFGH-JKLM-NPQR-ST' as const,
      recoveryKeyStatus: 'delivered' as const,
    };
    const harness = await render(
      <ReportReceiptExperience
        onViewStatus={() => undefined}
        receipt={receipt}
        retentionNotice="This browser does not save the recovery key automatically. Copy or download it now."
      />,
    );

    expect(harness.container.textContent).toContain('Report received.');
    expect(harness.container.textContent).toContain('Received — not yet reviewed.');
    expect(harness.container.textContent).toContain(receipt.report.reportId);
    expect(harness.container.textContent).toContain(receipt.recoveryKey);
    expect(harness.container.textContent).toContain('reviewed, verified or published');
    expect(harness.container.textContent).toContain('What happens next');
    await act(async () => control(harness.container, 'report-copy-recovery-key').click());
    expect(clipboardSetStringAsync).toHaveBeenCalledWith(receipt.recoveryKey);
    expect(control(harness.container, 'report-copy-recovery-key').textContent).toContain('Recovery key copied');
    await cleanup(harness);
  });

  it('requires confirmation before clearing a corrupt submission attempt, draft and evidence state', async () => {
    let recoveries = 0;
    const corruptDraft = updateReportDraft(validDraft(), {
      evidence: [{
        addedAt: '2026-08-11T09:00:00.000Z',
        fileName: 'private.png',
        id: 'private-evidence',
        mimeType: 'image/png',
        uri: 'file:///private/private.png',
      }],
    });
    const harness = await render(
      <PrivacyHarness
        initialDraft={corruptDraft}
        onRecover={() => { recoveries += 1; }}
        onSave={() => undefined}
        submissionError="The saved submission safety state is damaged."
        submissionRecoveryRequired
      />,
    );
    expect(control(harness.container, 'report-submit-private').getAttribute('aria-disabled')).toBe('true');
    expect(harness.container.textContent).toContain('may already have reached the server');
    await act(async () => control(harness.container, 'report-review-corrupt-recovery').click());
    expect(recoveries).toBe(0);
    expect(harness.container.textContent).toContain('clears the damaged attempt, private draft and local evidence');
    await act(async () => control(harness.container, 'report-confirm-corrupt-recovery').click());
    expect(recoveries).toBe(1);
    expect(harness.container.textContent).toContain('Finish the report details first.');
    expect(harness.container.textContent).not.toContain('private.png');
    await cleanup(harness);
  });

  it('renders receipt metadata without inventing a recovery key after the delivery window', async () => {
    const harness = await render(
      <ReportReceiptExperience
        onViewStatus={() => undefined}
        receipt={{
          report: {
            reportId: 'R-23456789ABCDEFGH',
            submittedAt: '2026-08-11T10:00:00.000Z',
            status: 'received',
            statusLabel: 'Received — not yet reviewed.',
            privateIntakeNotice: 'This private receipt does not mean the report has been reviewed, verified or published.',
          },
          recoveryKey: null,
          recoveryKeyStatus: 'unavailable',
        }}
        retentionNotice="The recovery key is no longer available from this retry."
      />,
    );
    expect(control(harness.container, 'report-recovery-key-unavailable').textContent).toContain('Not available again');
    expect(harness.container.querySelector('[data-testid="report-copy-recovery-key"]')).toBeNull();
    expect(harness.container.textContent).toContain('raw key is only delivered during a short retry window');
    await cleanup(harness);
  });
});
