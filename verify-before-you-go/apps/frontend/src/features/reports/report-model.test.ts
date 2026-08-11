import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyReportDraft,
  getReportEvidenceError,
  hasReportDraftErrors,
  parseReportDraft,
  reportBehaviourOptions,
  serializeReportDraft,
  toggleReportBehaviour,
  updateReportDraft,
  validateReportDraftForPrivacy,
} from './report-model';

const timestamp = '2026-08-11T08:00:00.000Z';

test('report intake exposes the seven observable incident categories required by the URD', () => {
  assert.deepEqual(reportBehaviourOptions.map((option) => option.id), [
    'identity-document-request',
    'payment-request',
    'pressure',
    'company-not-found',
    'contract-visa-mismatch',
    'travel-accommodation-control',
    'impersonation',
  ]);
  assert.doesNotMatch(reportBehaviourOptions.map((option) => option.title).join(' '), /scam|safe|guilty/iu);
});

test('privacy review requires one observed behaviour and one searchable identifier while evidence stays optional', () => {
  const empty = createEmptyReportDraft(timestamp);
  const emptyErrors = validateReportDraftForPrivacy(empty);
  assert.equal(emptyErrors.identifier, 'Add one searchable identifier or source location to continue.');
  assert.equal(emptyErrors.behaviours, 'Select at least one behaviour you observed.');
  assert.equal(hasReportDraftErrors(emptyErrors), true);

  const ready = updateReportDraft(
    toggleReportBehaviour(empty, 'payment-request', timestamp),
    { identifierType: 'handle', identifier: '@recruiter_demo' },
    timestamp,
  );
  assert.deepEqual(validateReportDraftForPrivacy(ready), {});
  assert.equal(ready.evidence.length, 0);
});

test('report drafts are anonymous and all optional sharing permissions default off', () => {
  const draft = createEmptyReportDraft(timestamp);
  assert.equal(draft.permissions.allowRedactedPublicAlert, false);
  assert.equal(draft.permissions.shareWithNamedPartner, false);
  assert.doesNotMatch(JSON.stringify(draft), /reporter(Name|Email|Phone)|accountId|userId/iu);
});

test('evidence validation accepts supported local images and rejects unsafe size or type', () => {
  assert.equal(getReportEvidenceError({ mimeType: 'image/png', fileSize: 200_000 }), undefined);
  assert.equal(getReportEvidenceError({ mimeType: 'application/pdf', fileSize: 200_000 }), 'Choose a JPEG, PNG or WebP image.');
  assert.equal(getReportEvidenceError({ mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 + 1 }), 'Choose an image smaller than 10 MB.');
});

test('version guard recovers invalid or future local draft data', () => {
  const recovered = parseReportDraft('{"schemaVersion":99,"identifier":"visible"}', timestamp);
  assert.equal(recovered.status, 'recovered');
  assert.equal(recovered.draft.schemaVersion, 1);
  assert.equal(recovered.draft.identifier, '');
});

test('valid draft round-trips with only report draft fields and timestamps', () => {
  const draft = updateReportDraft(
    toggleReportBehaviour(createEmptyReportDraft(timestamp), 'pressure', timestamp),
    { identifier: 'example.org/job', description: 'The sender said only two places remained.' },
    timestamp,
  );
  const parsed = parseReportDraft(serializeReportDraft(draft));
  assert.equal(parsed.status, 'valid');
  assert.deepEqual(parsed.draft, draft);
});
