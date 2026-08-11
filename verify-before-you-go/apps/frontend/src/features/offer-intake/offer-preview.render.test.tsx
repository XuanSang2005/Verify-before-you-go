import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { ANALYSIS_RULE_VERSION, type AnalyseOfferResponse } from '@vbyg/contracts';

import type { OfferDraft } from './model';
import { OfferPreviewExperience } from './OfferPreviewExperience';
import { OfferPreviewRoute } from './OfferPreviewScreen';

vi.mock('expo-status-bar', () => ({
  StatusBar: function MockStatusBar() { return null; },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: function MockSafeAreaView({ children }: { children?: ReactNode }) { return children ?? null; },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const draft: OfferDraft = {
  text: 'URGENT hiring at Acme Ltd.\nPay: USD 20 per hour.',
  link: 'https://example.org/jobs/123',
  saveRecentMetadata: false,
};

const analysis: AnalyseOfferResponse = {
  analysisId: 'analysis-0123456789abcdef',
  ruleVersion: ANALYSIS_RULE_VERSION,
  observedSignalCount: 0,
  checkedRuleCount: 9,
  findings: [],
  markedPassages: [],
  unknownInformation: ['The employer identity remains unverified.'],
  safetyStatement: 'These are observed signals, not a verdict. Verify the employer, recruiter and offer through independent official sources before acting.',
};

vi.mock('expo-router', () => ({
  router: { replace: vi.fn() },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: function MockIonicons() { return null; },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function control(container: HTMLElement, testID: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!element) throw new Error(`${testID} was not rendered`);
  return element;
}

function experience(overrides: Partial<ComponentProps<typeof OfferPreviewExperience>> = {}) {
  return (
    <OfferPreviewExperience
      analyseDraft={async () => analysis}
      draft={draft}
      dwell={async () => undefined}
      mascotSource={{ uri: 'screen03-analysis.jpg' }}
      onAnalysisComplete={() => undefined}
      onEdit={() => undefined}
      reduceMotion={false}
      {...overrides}
    />
  );
}

describe('Screen 03 preview analysis interactions', () => {
  it('moves from ready to analysing and completes only after response and dwell', async () => {
    const response = deferred<AnalyseOfferResponse>();
    const dwell = deferred<void>();
    const onComplete = vi.fn();
    const analyseDraft = vi.fn(() => response.promise);
    const harness = await mount(experience({
      analyseDraft,
      dwell: () => dwell.promise,
      onAnalysisComplete: onComplete,
    }));

    expect(harness.container.textContent).toContain('CHECK · READY TO ANALYSE');
    await act(async () => control(harness.container, 'preview-start').click());
    expect(harness.container.textContent).toContain('CHECK · ANALYSING');
    expect(analyseDraft).toHaveBeenCalledTimes(1);

    response.resolve(analysis);
    await settle();
    expect(onComplete).not.toHaveBeenCalled();

    dwell.resolve();
    await settle();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(analysis);
    await cleanup(harness.container, harness.root);
  });

  it('guards a double press before React commits the analysing state', async () => {
    const response = deferred<AnalyseOfferResponse>();
    const analyseDraft = vi.fn(() => response.promise);
    const harness = await mount(experience({ analyseDraft }));
    const start = control(harness.container, 'preview-start');

    await act(async () => {
      start.click();
      start.click();
    });
    expect(analyseDraft).toHaveBeenCalledTimes(1);

    await cleanup(harness.container, harness.root);
  });

  it('stops the scan treatment after an error and preserves Retry and Edit controls', async () => {
    const response = deferred<AnalyseOfferResponse>();
    const analyseDraft = vi.fn(() => response.promise);
    const harness = await mount(experience({ analyseDraft }));

    await act(async () => control(harness.container, 'preview-start').click());
    expect(harness.container.querySelector('[data-testid="preview-scan-lines-moving"]')).not.toBeNull();
    response.reject(new Error('Local service unavailable.'));
    await settle();

    expect(harness.container.querySelector('[data-testid="preview-scan-lines-moving"]')).toBeNull();
    expect(control(harness.container, 'preview-analysis-error').textContent).toContain('Local service unavailable.');
    expect(control(harness.container, 'preview-retry')).toBeTruthy();
    expect(control(harness.container, 'preview-edit')).toBeTruthy();
    expect(harness.container.textContent).toContain(draft.text);
    await cleanup(harness.container, harness.root);
  });

  it('retries from a recoverable error without losing the draft', async () => {
    const onComplete = vi.fn();
    const onEdit = vi.fn();
    const analyseDraft = vi.fn()
      .mockRejectedValueOnce(new Error('Try again.'))
      .mockResolvedValueOnce(analysis);
    const harness = await mount(experience({ analyseDraft, onAnalysisComplete: onComplete, onEdit }));

    await act(async () => control(harness.container, 'preview-start').click());
    await settle();
    expect(harness.container.textContent).toContain(draft.text);
    await act(async () => control(harness.container, 'preview-edit').click());
    expect(onEdit).toHaveBeenCalledTimes(1);

    await act(async () => control(harness.container, 'preview-retry').click());
    await settle();
    expect(analyseDraft).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledWith(analysis);
    await cleanup(harness.container, harness.root);
  });

  it('aborts the active API signal when the preview unmounts', async () => {
    let signal: AbortSignal | undefined;
    const analyseDraft = vi.fn((_draft: OfferDraft, options: { signal?: AbortSignal }) => {
      signal = options.signal;
      return new Promise<AnalyseOfferResponse>(() => undefined);
    });
    const harness = await mount(experience({ analyseDraft }));

    await act(async () => control(harness.container, 'preview-start').click());
    expect(signal?.aborted).toBe(false);
    await cleanup(harness.container, harness.root);
    expect(signal?.aborted).toBe(true);
  });

  it('uses reduced motion with a static beam and no artificial dwell', async () => {
    const dwell = vi.fn(async () => undefined);
    const onComplete = vi.fn();
    const harness = await mount(experience({ dwell, onAnalysisComplete: onComplete, reduceMotion: true }));

    await act(async () => control(harness.container, 'preview-start').click());
    expect(harness.container.querySelector('[data-testid="preview-scan-lines-static"]')).not.toBeNull();
    await settle();
    expect(dwell).not.toHaveBeenCalled();
    expect(harness.container.querySelector('[data-testid="preview-scan-lines-moving"]')).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
    await cleanup(harness.container, harness.root);
  });

  it('shows the exact screenshot disclosure without rendering or describing OCR', async () => {
    const harness = await mount(experience({
      draft: {
        ...draft,
        screenshot: { uri: 'file:///private/sensitive.jpg', width: 900, height: 1200 },
      },
    }));

    expect(control(harness.container, 'preview-screenshot-summary').textContent)
      .toBe('Screenshot attached · no text extracted or uploaded');
    expect(harness.container.textContent).not.toMatch(/OCR/i);
    expect(harness.container.querySelector('img[src*="sensitive"]')).toBeNull();
    await cleanup(harness.container, harness.root);
  });

  it('does not create an analysis request on direct refresh without a transient draft', async () => {
    const analyseDraft = vi.fn(async () => analysis);
    const emptyDraft: OfferDraft = { text: '', link: '', saveRecentMetadata: false };
    const harness = await mount(
      <OfferPreviewRoute
        analyseDraft={analyseDraft}
        draft={emptyDraft}
        mascotSource={{ uri: 'screen03-analysis.jpg' }}
        onAnalysisComplete={() => undefined}
        onEdit={() => undefined}
        onReturnToCheck={() => undefined}
        reduceMotion={false}
      />,
    );

    expect(harness.container.textContent).toContain('No draft is available.');
    expect(analyseDraft).not.toHaveBeenCalled();
    expect(control(harness.container, 'preview-empty-return')).toBeTruthy();
    await cleanup(harness.container, harness.root);
  });

  it.each([360, 390, 768, 1024])('clips scan lines and preserves 48px controls at %ipx', async (width) => {
    const harness = await mount(experience());
    harness.container.style.width = `${width}px`;
    const scanSheet = control(harness.container, 'preview-scan-sheet');
    const start = control(harness.container, 'preview-start');
    const edit = control(harness.container, 'preview-edit');
    const startStyle = getComputedStyle(start);
    const editStyle = getComputedStyle(edit);

    expect(Number.parseFloat(startStyle.minHeight)).toBeGreaterThanOrEqual(48);
    expect(Number.parseFloat(editStyle.minHeight)).toBeGreaterThanOrEqual(48);
    expect(harness.container.scrollWidth).toBeLessThanOrEqual(width);
    await act(async () => start.click());
    const lines = control(harness.container, 'preview-scan-lines-moving');
    expect(lines.parentElement).toBe(scanSheet);
    expect(lines.getAttribute('aria-label')).toBeNull();
    expect(lines.textContent).toBe('');
    await cleanup(harness.container, harness.root);
  });
});
