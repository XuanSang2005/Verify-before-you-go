import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import {
  copyPrivateSummary,
  sharePrivateSummary,
  type PrivateShareAdapters,
  type PrivateShareBundle,
  type PrivateShareResult,
} from './share-service';

export function sharePrivateSummaryWithRuntime(bundle: PrivateShareBundle): Promise<PrivateShareResult> {
  return sharePrivateSummary(bundle, createRuntimeShareAdapters());
}

export function copyPrivateSummaryWithRuntime(bundle: PrivateShareBundle): Promise<'copied' | 'copied-text-only'> {
  return copyPrivateSummary(bundle, Clipboard.setStringAsync);
}

function createRuntimeShareAdapters(): PrivateShareAdapters {
  const platform = Platform.OS === 'web'
    ? 'web'
    : Platform.OS === 'ios'
      ? 'ios'
      : Platform.OS === 'android'
        ? 'android'
        : 'other';

  return {
    platform,
    webShare: platform === 'web' && typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      ? (data) => navigator.share(data)
      : undefined,
    nativeShare: (content) => Share.share(content),
    copy: Clipboard.setStringAsync,
  };
}
