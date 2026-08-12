import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportContact } from '@vbyg/contracts';

import {
  filterSupportContacts,
  isSupportReviewDue,
} from './support-model';

const baseContact: SupportContact = {
  id: 'support-cambodia-1288',
  country: 'cambodia',
  countryLabel: 'Cambodia',
  kind: 'emergency',
  title: 'Anti-trafficking hotline',
  description: 'Human-trafficking reporting short code.',
  displayValue: '1288',
  actionUri: 'tel:1288',
  actionLabel: 'Call 1288',
  accessMode: 'cellular',
  accessLabel: 'No data · cellular service required',
  dataStatus: 'reviewed-reference',
  dataStatusLabel: 'Reviewed emergency reference',
  sourceOwner: 'Telecommunication Regulator of Cambodia',
  sourceUrl: 'https://www.trc.gov.kh/en/resources/emergency-numbers/',
  languages: [],
  languageStatus: 'unconfirmed',
  hours: 'Availability not independently confirmed',
  lastReviewedAt: '2026-08-12T00:00:00.000Z',
  nextReviewAt: '2026-09-12T00:00:00.000Z',
  reviewStatus: 'current',
  sortOrder: 10,
};

test('country filtering is local, stable and sorted without changing the API query', () => {
  const contacts = [
    { ...baseContact, id: 'support-vietnam-111', country: 'vietnam' as const, sortOrder: 20 },
    { ...baseContact, id: 'support-cambodia-117', sortOrder: 20 },
    baseContact,
  ];
  assert.deepEqual(
    filterSupportContacts(contacts, 'cambodia').map((contact) => contact.id),
    ['support-cambodia-1288', 'support-cambodia-117'],
  );
});

test('a cached contact becomes review-due when its next-review time passes', () => {
  assert.equal(isSupportReviewDue(baseContact, new Date('2026-08-13T00:00:00.000Z')), false);
  assert.equal(isSupportReviewDue(baseContact, new Date('2026-10-01T00:00:00.000Z')), true);
});
