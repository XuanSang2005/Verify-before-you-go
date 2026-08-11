import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyReportDraft, updateReportDraft } from './report-model';
import {
  containsDirectIdentifier,
  createReportRedactionPreview,
  redactReportIdentifier,
  redactSensitiveReportText,
} from './report-redaction';

test('client preview redacts email, handle, phone, passport number and home address', () => {
  const source = 'Email linh@example.org, contact @linh_hr_2026 or +855 12 345 678. Passport no. AB1234567. Home address: 21 Example Road';
  const redacted = redactSensitiveReportText(source);
  assert.doesNotMatch(redacted, /linh@example\.org|@linh_hr_2026|12 345 678|AB1234567|21 Example Road/iu);
  assert.match(redacted, /email hidden/iu);
  assert.match(redacted, /handle ending ••••2026/iu);
  assert.match(redacted, /phone ending ••••5678/iu);
  assert.match(redacted, /identity document number hidden/iu);
  assert.match(redacted, /home address hidden/iu);
});

test('identifier preview removes URL path and query and masks direct identifier endings', () => {
  assert.equal(redactReportIdentifier('url', 'https://jobs.example.org/private/123?token=secret'), 'Link on jobs.example.org');
  assert.equal(redactReportIdentifier('url', 'www.example.org/private/123?token=secret'), 'Link on www.example.org');
  assert.equal(redactReportIdentifier('handle', '@linh_hr_2026'), 'Messaging handle ending ••••2026');
  assert.equal(redactReportIdentifier('phone', '+855 12 345 678'), 'Phone ending ••••5678');
  assert.equal(redactReportIdentifier('handle', '@abcd'), 'Messaging handle ending ••••');
  assert.equal(redactReportIdentifier('payment-account', 'ABCD'), 'Payment reference ending ••••');
});

test('redaction handles dotted and hyphenated handles, schemeless URLs and spaced identity numbers', () => {
  const vectors = [
    '@john.doe',
    '@john-doe',
    'www.example.org/private/123?token=secret',
    'Passport no. AB 1234567',
    'Home address 21 Example Road',
    'Residential address: 9 Private Lane',
  ];
  const redacted = vectors.map(redactSensitiveReportText);

  assert.equal(redacted[0], 'Messaging handle ending ••••oe');
  assert.equal(redacted[1], 'Messaging handle ending ••••oe');
  assert.equal(redacted[2], 'Link on www.example.org');
  assert.equal(redacted[3], '[identity document number hidden]');
  assert.equal(redacted[4], '[home address hidden]');
  assert.equal(redacted[5], '[home address hidden]');
  vectors.forEach((vector) => assert.equal(containsDirectIdentifier(vector), true, vector));
  redacted.forEach((value) => assert.equal(containsDirectIdentifier(value), false, value));
});

test('quoted, bracketed and slash-delimited handles preserve punctuation without leaking the handle', () => {
  const exactVectors = [
    "Contact '@john-doe'",
    'Handle=[@john-doe]',
    'reach/@john-doe',
    'Contact [@john.doe]',
  ];

  for (const source of exactVectors) {
    assert.equal(containsDirectIdentifier(source), true, source);
    const redacted = redactSensitiveReportText(source);
    assert.doesNotMatch(redacted, /@john[-.]doe/iu, redacted);
    assert.match(redacted, /Messaging handle ending ••••oe/iu, redacted);
    assert.equal(containsDirectIdentifier(redacted), false, redacted);
  }

  assert.equal(redactSensitiveReportText(exactVectors[0]!), "Contact 'Messaging handle ending ••••oe'");
  assert.equal(redactSensitiveReportText(exactVectors[1]!), 'Handle=[Messaging handle ending ••••oe]');
  assert.equal(redactSensitiveReportText(exactVectors[2]!), 'reach/Messaging handle ending ••••oe');
  assert.equal(redactSensitiveReportText(exactVectors[3]!), 'Contact [Messaging handle ending ••••oe]');
});

test('email domains are never reclassified as handles or scheme-less URLs', () => {
  const source = 'Contact person@example.com';
  const redacted = redactSensitiveReportText(source);
  assert.equal(containsDirectIdentifier(source), true);
  assert.equal(redacted, 'Contact [email hidden]');
  assert.equal(containsDirectIdentifier(redacted), false);
});

test('preview keeps protected original separate from possible public derivative', () => {
  const draft = updateReportDraft(createEmptyReportDraft('2026-08-11T08:00:00.000Z'), {
    identifierType: 'handle',
    identifier: '@linh_hr_2026',
    description: 'Contact @linh_hr_2026 and send passport no. AB1234567.',
  }, '2026-08-11T08:01:00.000Z');
  const preview = createReportRedactionPreview(draft);
  assert.equal(preview.privateEvidence, '@linh_hr_2026');
  assert.doesNotMatch(preview.possiblePublicVersion, /@linh_hr_2026|AB1234567/iu);
  assert.match(preview.hiddenSummary, /full handle/iu);
});

test('edited public preview detector identifies direct values but not masked output', () => {
  assert.equal(containsDirectIdentifier('Contact @visible_handle or person@example.org'), true);
  assert.equal(containsDirectIdentifier('@abcd'), true);
  assert.equal(containsDirectIdentifier('ABCD'), true);
  assert.equal(containsDirectIdentifier('Payment reference: ABCD'), true);
  assert.equal(containsDirectIdentifier('Messaging handle ending ••••2026'), false);
  assert.equal(containsDirectIdentifier('Messaging handle ending ••••'), false);
  assert.equal(containsDirectIdentifier('Phone ending ••••5678'), false);
  assert.equal(containsDirectIdentifier('Link on www.example.org'), false);
});
