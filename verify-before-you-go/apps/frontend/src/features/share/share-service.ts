import { buildPrivateShareText, type SafeShareSummary } from './share-model';

export type PrivateShareBundle = {
  title: string;
  text: string;
  url?: string;
};

export type PrivateShareResult =
  | 'shared'
  | 'copied'
  | 'shared-text-only'
  | 'copied-text-only'
  | 'dismissed';

export type PrivateShareAdapters = {
  platform: 'web' | 'ios' | 'android' | 'other';
  webShare?: (data: ShareData) => Promise<void>;
  nativeShare: (content: { title: string; message: string; url?: string }) => Promise<{ action?: string }>;
  copy?: (value: string) => Promise<boolean | void>;
};

export function createPrivateShareBundle(summary: SafeShareSummary, recipientUrl?: string): PrivateShareBundle {
  return {
    title: 'Private offer verification summary',
    text: buildPrivateShareText(summary),
    url: recipientUrl,
  };
}

export async function sharePrivateSummary(
  bundle: PrivateShareBundle,
  adapters: PrivateShareAdapters,
): Promise<PrivateShareResult> {
  if (adapters.platform === 'web') {
    if (adapters.webShare) {
      try {
        await adapters.webShare({
          title: bundle.title,
          text: bundle.text,
          ...(bundle.url ? { url: bundle.url } : {}),
        });
        return bundle.url ? 'shared' : 'shared-text-only';
      } catch (error) {
        if (isShareDismissal(error)) return 'dismissed';
        throw error;
      }
    }
    await writeClipboard(createShareContent(bundle), adapters.copy);
    return bundle.url ? 'copied' : 'copied-text-only';
  }

  const message = adapters.platform === 'ios'
    ? bundle.text
    : createShareContent(bundle);
  const result = await adapters.nativeShare({
    title: bundle.title,
    message,
    ...(adapters.platform === 'ios' && bundle.url ? { url: bundle.url } : {}),
  });
  if (result.action === 'dismissedAction') return 'dismissed';
  return bundle.url ? 'shared' : 'shared-text-only';
}

export async function copyPrivateSummary(
  bundle: PrivateShareBundle,
  copy: ((value: string) => Promise<boolean | void>) | undefined,
): Promise<'copied' | 'copied-text-only'> {
  await writeClipboard(createShareContent(bundle), copy);
  return bundle.url ? 'copied' : 'copied-text-only';
}

function isShareDismissal(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createShareContent(bundle: PrivateShareBundle): string {
  return bundle.url ? `${bundle.text}\n\n${bundle.url}` : bundle.text;
}

async function writeClipboard(
  value: string,
  copy: ((content: string) => Promise<boolean | void>) | undefined,
): Promise<void> {
  if (!copy) throw new Error('Clipboard is unavailable.');
  const result = await copy(value);
  if (result === false) throw new Error('Clipboard write failed.');
}
