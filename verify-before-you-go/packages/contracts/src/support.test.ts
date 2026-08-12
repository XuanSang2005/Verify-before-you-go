import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SupportContactSchema,
  SupportDirectoryQuerySchema,
  SupportDirectoryResponseSchema,
} from './support.js';

const contact = {
  id: 'support-cambodia-1288',
  country: 'cambodia',
  countryLabel: 'Cambodia',
  kind: 'emergency',
  title: 'Anti-trafficking hotline',
  description: 'Human-trafficking reporting line in Cambodia.',
  displayValue: '1288',
  actionUri: 'tel:1288',
  actionLabel: 'Call 1288',
  accessMode: 'cellular',
  accessLabel: 'No data · cellular service required',
  dataStatus: 'reviewed-reference',
  dataStatusLabel: 'Reviewed emergency reference',
  sourceOwner: 'Telecommunication Regulator of Cambodia',
  sourceUrl: 'https://www.trc.gov.kh/en/resources/emergency-numbers/',
  languages: ['Confirm with provider'],
  hours: 'Availability not independently confirmed',
  lastReviewedAt: '2026-08-12T00:00:00.000Z',
  nextReviewAt: '2026-09-12T00:00:00.000Z',
  reviewStatus: 'current',
  sortOrder: 10,
} as const;

test('support directory query is strict and allowlists Cambodia and Vietnam', () => {
  assert.deepEqual(SupportDirectoryQuerySchema.parse({ country: 'cambodia' }), { country: 'cambodia' });
  assert.equal(SupportDirectoryQuerySchema.safeParse({ country: 'other' }).success, false);
  assert.equal(SupportDirectoryQuerySchema.safeParse({ country: 'vietnam', extra: 'value' }).success, false);
});

test('support contact distinguishes access, data and review status', () => {
  const parsed = SupportContactSchema.parse(contact);
  assert.equal(parsed.accessMode, 'cellular');
  assert.equal(parsed.dataStatus, 'reviewed-reference');
  assert.equal(parsed.reviewStatus, 'current');
});

test('support actions fail closed on unsafe or mismatched URI schemes', () => {
  assert.equal(SupportContactSchema.safeParse({ ...contact, actionUri: 'javascript:alert(1)' }).success, false);
  assert.equal(SupportContactSchema.safeParse({ ...contact, actionUri: 'https://example.org/' }).success, false);
  assert.equal(SupportContactSchema.safeParse({ ...contact, sourceUrl: 'http://example.org/' }).success, false);
});

test('support response is versioned and rejects unsupported public fields', () => {
  const response = SupportDirectoryResponseSchema.parse({
    schemaVersion: 1,
    contacts: [contact],
    fetchedAt: '2026-08-12T00:00:00.000Z',
    directoryNotice: 'This directory does not monitor emergencies or verify that help is currently available. Contact and location sharing happen only when you choose an action.',
  });
  assert.equal(response.contacts.length, 1);
  assert.equal(SupportDirectoryResponseSchema.safeParse({ ...response, privateNote: 'hidden' }).success, false);
});
