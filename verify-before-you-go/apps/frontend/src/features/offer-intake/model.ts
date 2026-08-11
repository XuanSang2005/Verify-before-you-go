export const MAX_POSTING_TEXT_LENGTH = 12_000;
export const MAX_LINK_LENGTH = 2_048;
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

export interface ScreenshotDraft {
  uri: string;
  width: number;
  height: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface OfferDraft {
  text: string;
  link: string;
  screenshot?: ScreenshotDraft;
  saveRecentMetadata: boolean;
  exampleId?: string;
}

export interface OfferDraftErrors {
  general?: string;
  text?: string;
  link?: string;
  screenshot?: string;
}

export function createEmptyOfferDraft(): OfferDraft {
  return {
    text: '',
    link: '',
    saveRecentMetadata: false,
  };
}

export function prepareOfferDraft(draft: OfferDraft): OfferDraft {
  return {
    ...draft,
    text: draft.text.trim(),
    link: draft.link.trim(),
  };
}

export function validateOfferDraft(draft: OfferDraft): OfferDraftErrors {
  const prepared = prepareOfferDraft(draft);
  const errors: OfferDraftErrors = {};

  if (!prepared.text && !prepared.link && !prepared.screenshot) {
    errors.general = 'Add posting text, a recruitment link or a screenshot to continue.';
  }

  if (prepared.text.length > MAX_POSTING_TEXT_LENGTH) {
    errors.text = `Keep the posting text under ${MAX_POSTING_TEXT_LENGTH.toLocaleString('en-US')} characters.`;
  }

  if (prepared.link) {
    if (prepared.link.length > MAX_LINK_LENGTH) {
      errors.link = 'The recruitment link is too long.';
    } else {
      try {
        const url = new URL(prepared.link);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          errors.link = 'Use a complete http:// or https:// recruitment link.';
        }
      } catch {
        errors.link = 'Enter a complete link, for example https://example.org/job-posting.';
      }
    }
  }

  if (prepared.screenshot?.fileSize && prepared.screenshot.fileSize > MAX_SCREENSHOT_BYTES) {
    errors.screenshot = 'Choose an image smaller than 10 MB.';
  }

  return errors;
}

export function hasOfferDraftErrors(errors: OfferDraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function getDraftInputKinds(draft: OfferDraft): ('text' | 'link' | 'screenshot')[] {
  const kinds: ('text' | 'link' | 'screenshot')[] = [];
  if (draft.text.trim()) kinds.push('text');
  if (draft.link.trim()) kinds.push('link');
  if (draft.screenshot) kinds.push('screenshot');
  return kinds;
}
