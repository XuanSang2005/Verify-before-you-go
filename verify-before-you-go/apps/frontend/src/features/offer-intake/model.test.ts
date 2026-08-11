import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_POSTING_TEXT_LENGTH,
  MAX_SCREENSHOT_BYTES,
  createEmptyOfferDraft,
  getDraftInputKinds,
  hasOfferDraftErrors,
  prepareOfferDraft,
  validateOfferDraft,
} from './model';

test('requires at least one transient offer input', () => {
  const errors = validateOfferDraft(createEmptyOfferDraft());
  assert.equal(errors.general, 'Add posting text, a recruitment link or a screenshot to continue.');
  assert.equal(hasOfferDraftErrors(errors), true);
});

test('accepts text, a valid link and a screenshot without analysing them', () => {
  const draft = {
    text: '  Synthetic recruitment posting content  ',
    link: ' https://jobs.example.org/posting/42 ',
    screenshot: { uri: 'file:///local/screenshot.png', width: 390, height: 844, fileSize: 200_000 },
    saveRecentMetadata: false,
  };
  assert.deepEqual(validateOfferDraft(draft), {});
  assert.deepEqual(getDraftInputKinds(draft), ['text', 'link', 'screenshot']);
  assert.equal(prepareOfferDraft(draft).text, 'Synthetic recruitment posting content');
});

test('rejects unsafe links and oversized local inputs', () => {
  const errors = validateOfferDraft({
    text: 'x'.repeat(MAX_POSTING_TEXT_LENGTH + 1),
    link: 'javascript:alert(1)',
    screenshot: { uri: 'file:///large.png', width: 100, height: 100, fileSize: MAX_SCREENSHOT_BYTES + 1 },
    saveRecentMetadata: false,
  });
  assert.match(errors.text ?? '', /under 12,000 characters/);
  assert.match(errors.link ?? '', /http:\/\//);
  assert.equal(errors.screenshot, 'Choose an image smaller than 10 MB.');
});
