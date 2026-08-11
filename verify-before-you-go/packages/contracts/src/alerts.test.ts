import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AlertDetailResponseSchema,
  AlertListQuerySchema,
  AlertListResponseSchema,
  MaskedAlertIdentifierSchema,
} from './alerts.js';

const summary = {
  id: 'A-018',
  title: 'Telegram recruitment pattern',
  location: 'cambodia',
  locationLabel: 'Sihanoukville, Cambodia',
  category: 'off-platform-contact',
  categoryLabel: 'Off-platform contact',
  moderationStatus: 'corroborated-pattern',
  moderationStatusLabel: 'Corroborated pattern',
  summary: 'Four compatible reports describe a passport request before written terms.',
  compatibleReportCount: 4,
  maskedIdentifiers: ['@••••••2026'],
  syntheticLabel: 'Synthetic demo data',
  firstReportedAt: '2026-07-21T02:00:00.000Z',
  reviewedAt: '2026-07-30T02:00:00.000Z',
} as const;

test('alert contracts accept reviewed, masked synthetic records', () => {
  const list = AlertListResponseSchema.parse({
    alerts: [summary],
    fetchedAt: '2026-08-10T02:00:00.000Z',
    syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
  });
  const detail = AlertDetailResponseSchema.parse({
    alert: {
      ...summary,
      observedEvidence: ['Contact was limited to a personal Telegram handle.'],
      unknownInformation: ['Who controls the handle.'],
      verificationSteps: ['Find the legal employer through an independent source.'],
      sourceNotes: ['All names and identifiers in this fixture are synthetic and masked.'],
      safetyStatement: 'This reviewed record is not a verdict and does not establish fraud.',
    },
  });

  assert.equal(list.alerts[0]?.maskedIdentifiers[0], '@••••••2026');
  assert.equal(detail.alert.safetyStatement.includes('not a verdict'), true);
});

test('alert list query accepts canonical search, location and category filters', () => {
  const parsed = AlertListQuerySchema.parse({
    search: 'telegram',
    location: 'cambodia',
    category: 'off-platform-contact',
  });
  assert.deepEqual(parsed, {
    search: 'telegram',
    location: 'cambodia',
    category: 'off-platform-contact',
  });
  assert.equal(AlertListQuerySchema.safeParse({ location: 'unknown' }).success, false);
  assert.equal(AlertListQuerySchema.safeParse({ search: 'telegram', unsupported: 'value' }).success, false);
});

test('alert contracts reject unmasked, weakly masked and trailing-mask padding identifiers', () => {
  for (const maskedIdentifiers of [
    ['@synthetic-recruiter'],
    ['@synthetic-recruite•'],
    ['john.smith@example.com***'],
    ['+855123456789••••••'],
    ['@visible-handle************'],
    ['+1 ** 1234'],
    ['+84 •• 731'],
    ['+855 ** 408'],
  ]) {
    assert.equal(AlertListResponseSchema.safeParse({
      alerts: [{ ...summary, maskedIdentifiers }],
      fetchedAt: '2026-08-10T02:00:00.000Z',
      syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
    }).success, false);
  }
});

test('masked identifier invariant accepts seeded formats only with at least three masks', () => {
  for (const identifier of ['@••••••work', '+855 •• ••• 408']) {
    assert.equal(MaskedAlertIdentifierSchema.safeParse(identifier).success, true);
  }
  for (const identifier of ['+1 ** 1234', '+84 •• 731', '+855 ** 408']) {
    assert.equal(MaskedAlertIdentifierSchema.safeParse(identifier).success, false);
  }
});

test('alert contracts reject mixed Unicode mask bypasses outside allowlisted formats', () => {
  for (const maskedIdentifiers of [
    ['@visible-handle•*•*'],
    ['person@example.test•*•*'],
    ['+855123456789•*•*'],
    ['@visible●•*•'],
  ]) {
    assert.equal(AlertListResponseSchema.safeParse({
      alerts: [{ ...summary, maskedIdentifiers }],
      fetchedAt: '2026-08-10T02:00:00.000Z',
      syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
    }).success, false);
  }
});

test('alert response objects and IDs are strict', () => {
  assert.equal(AlertListResponseSchema.safeParse({
    alerts: [{ ...summary, internalEvidence: 'must not cross the public boundary' }],
    fetchedAt: '2026-08-10T02:00:00.000Z',
    syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
  }).success, false);
  assert.equal(AlertListResponseSchema.safeParse({
    alerts: [{ ...summary, id: 'internal-row-18' }],
    fetchedAt: '2026-08-10T02:00:00.000Z',
    syntheticContentNotice: 'These alerts are reviewed synthetic prototype records, not live allegations or verdicts.',
  }).success, false);
});
