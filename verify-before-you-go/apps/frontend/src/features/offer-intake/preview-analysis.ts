import type { AnalyseOfferResponse } from '@vbyg/contracts';

import type { AnalyseOfferDraftOptions } from '@/features/analysis/api';

import type { OfferDraft } from './model';

export const PREVIEW_MINIMUM_DWELL_MS = 1_600;

export const ANALYSIS_STATUS_MESSAGES = [
  'READING SUBMITTED TEXT',
  'MATCHING OBSERVED SIGNALS',
  'PREPARING CHECK STEPS',
  'WAITING FOR THE LOCAL ANALYSIS SERVICE',
] as const;

export type AnalysePreviewDraft = (
  draft: OfferDraft,
  options: AnalyseOfferDraftOptions,
) => Promise<AnalyseOfferResponse>;

export type PreviewDwell = (signal: AbortSignal) => Promise<void>;

export interface PreviewAnalysisAttempt {
  completion: Promise<AnalyseOfferResponse>;
  id: number;
  signal: AbortSignal;
}

export class PreviewAnalysisCoordinator {
  private activeController?: AbortController;
  private revision = 0;

  constructor(
    private readonly analyse: AnalysePreviewDraft,
    private readonly dwell: PreviewDwell = waitForPreviewDwell,
  ) {}

  start(draft: OfferDraft, skipDwell: boolean): PreviewAnalysisAttempt {
    this.activeController?.abort();

    const id = ++this.revision;
    const controller = new AbortController();
    this.activeController = controller;
    const completion = Promise.all([
      this.analyse(draft, { signal: controller.signal }),
      skipDwell ? Promise.resolve() : this.dwell(controller.signal),
    ]).then(([result]) => result);

    return { completion, id, signal: controller.signal };
  }

  isCurrent(id: number): boolean {
    return id === this.revision && !this.activeController?.signal.aborted;
  }

  finish(id: number): void {
    if (id === this.revision) this.activeController = undefined;
  }

  cancel(): void {
    this.activeController?.abort();
    this.activeController = undefined;
    this.revision += 1;
  }
}

export function waitForPreviewDwell(
  signal: AbortSignal,
  durationMs = PREVIEW_MINIMUM_DWELL_MS,
): Promise<void> {
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, durationMs);
    const handleAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', handleAbort);
      reject(createAbortError());
    };
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export function isPreviewAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError');
}

export function shouldAnimateScanBeam(
  phase: 'ready' | 'analysing' | 'error',
  reduceMotion: boolean,
  measuredHeight: number,
  hasScannableContent: boolean,
): boolean {
  return phase === 'analysing' && !reduceMotion && measuredHeight > 0 && hasScannableContent;
}

function createAbortError(): Error {
  const error = new Error('The preview analysis was cancelled.');
  error.name = 'AbortError';
  return error;
}
