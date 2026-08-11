import { getDraftInputKinds, type OfferDraft } from './model';

export interface RecentCheckMetadata {
  id: string;
  savedAt: string;
  inputKinds: ('text' | 'link' | 'screenshot')[];
}

export function buildRecentCheckMetadata(draft: OfferDraft, id: string, savedAt: string): RecentCheckMetadata {
  return {
    id,
    savedAt,
    inputKinds: getDraftInputKinds(draft),
  };
}

export function parseRecentChecks(value: string | null): RecentCheckMetadata[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentCheckMetadata => {
        if (!item || typeof item !== 'object') return false;
        const record = item as Record<string, unknown>;
        return (
          typeof record.id === 'string' &&
          typeof record.savedAt === 'string' &&
          Array.isArray(record.inputKinds) &&
          record.inputKinds.every((kind) => kind === 'text' || kind === 'link' || kind === 'screenshot')
        );
      })
      .slice(0, 5)
      .map(({ id, savedAt, inputKinds }) => ({ id, savedAt, inputKinds }));
  } catch {
    return [];
  }
}
