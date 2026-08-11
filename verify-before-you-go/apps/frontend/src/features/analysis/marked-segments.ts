import type { AnalysisFindingId, MarkedPassage } from '@vbyg/contracts';

export const MIN_MARKED_PASSAGE_TARGET = 44;

export interface MarkedTextSegment {
  text: string;
  findingId?: AnalysisFindingId;
  findingIds?: AnalysisFindingId[];
}

export function buildMarkedTextSegments(text: string, passages: MarkedPassage[]): MarkedTextSegment[] {
  const ordered = [...passages]
    .filter((passage) => passage.start >= 0 && passage.end <= text.length && passage.start < passage.end)
    .filter((passage) => text.slice(passage.start, passage.end) === passage.text)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const regions: { start: number; end: number; findingIds: AnalysisFindingId[] }[] = [];

  for (const passage of ordered) {
    const previous = regions.at(-1);
    if (previous && passage.start < previous.end) {
      previous.end = Math.max(previous.end, passage.end);
      if (!previous.findingIds.includes(passage.findingId)) previous.findingIds.push(passage.findingId);
    } else {
      regions.push({ start: passage.start, end: passage.end, findingIds: [passage.findingId] });
    }
  }

  const segments: MarkedTextSegment[] = [];
  let cursor = 0;

  for (const region of regions) {
    if (region.start > cursor) segments.push({ text: text.slice(cursor, region.start) });
    segments.push({
      text: text.slice(region.start, region.end),
      findingId: region.findingIds[0],
      findingIds: region.findingIds,
    });
    cursor = region.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : [{ text }];
}
