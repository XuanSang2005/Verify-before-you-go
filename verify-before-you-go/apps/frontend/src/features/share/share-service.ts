import { buildPrivateShareText, type SafeShareSummary } from './share-model';

export type PrivateShareBundle = {
  title: string;
  text: string;
  url: string;
};

export type PrivateShareResult = 'shared' | 'copied' | 'dismissed';

export type PrivateShareAdapters = {
  platform: 'web' | 'ios' | 'android' | 'other';
  webShare?: (data: ShareData) => Promise<void>;
  nativeShare: (content: { title: string; message: string; url?: string }) => Promise<{ action?: string }>;
  copy: (value: string) => Promise<unknown>;
};

export function createPrivateShareBundle(summary: SafeShareSummary, recipientUrl: string): PrivateShareBundle {
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
        await adapters.webShare({ title: bundle.title, text: bundle.text, url: bundle.url });
        return 'shared';
      } catch (error) {
        if (isShareDismissal(error)) return 'dismissed';
        throw error;
      }
    }
    await adapters.copy(`${bundle.text}\n\n${bundle.url}`);
    return 'copied';
  }

  const message = adapters.platform === 'ios'
    ? bundle.text
    : `${bundle.text}\n\n${bundle.url}`;
  const result = await adapters.nativeShare({
    title: bundle.title,
    message,
    ...(adapters.platform === 'ios' ? { url: bundle.url } : {}),
  });
  return result.action === 'dismissedAction' ? 'dismissed' : 'shared';
}

export async function copyPrivateSummary(
  bundle: PrivateShareBundle,
  copy: (value: string) => Promise<unknown>,
): Promise<void> {
  await copy(`${bundle.text}\n\n${bundle.url}`);
}

function isShareDismissal(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
