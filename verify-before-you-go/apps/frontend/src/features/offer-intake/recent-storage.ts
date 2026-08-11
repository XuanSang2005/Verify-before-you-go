import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OfferDraft } from './model';
import { buildRecentCheckMetadata, parseRecentChecks, type RecentCheckMetadata } from './recent-model';

const RECENT_CHECKS_KEY = '@vbyg/recent-checks/v1';

export async function loadRecentChecks(): Promise<RecentCheckMetadata[]> {
  return parseRecentChecks(await AsyncStorage.getItem(RECENT_CHECKS_KEY));
}

export async function saveRecentCheckMetadata(draft: OfferDraft): Promise<RecentCheckMetadata[]> {
  const current = await loadRecentChecks();
  const now = new Date();
  const next = [
    buildRecentCheckMetadata(draft, `local-${now.getTime()}`, now.toISOString()),
    ...current,
  ].slice(0, 5);
  await AsyncStorage.setItem(RECENT_CHECKS_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentChecks(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_CHECKS_KEY);
}
