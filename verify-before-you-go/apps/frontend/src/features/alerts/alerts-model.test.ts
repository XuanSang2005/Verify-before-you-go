import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlertSummary } from '@vbyg/contracts';

import { alertSummaryFixture } from './alerts-test-fixtures';
import {
  ALERT_PROTOTYPE_IDS,
  filterCommunityAlerts,
  formatAlertDate,
} from './alerts-model';

const vietnamAlert: AlertSummary = {
  ...alertSummaryFixture,
  id: 'A-036',
  title: 'Processing fee sent to a personal account',
  location: 'vietnam',
  locationLabel: 'Hanoi, Vietnam',
  category: 'upfront-payment',
  categoryLabel: 'Upfront payment',
  summary: 'A processing fee was requested without a written breakdown.',
  maskedIdentifiers: ['ACCT •••• 5519'],
};

test('community alert search includes masked identifiers and content fields', () => {
  const alerts = [alertSummaryFixture, vietnamAlert];
  assert.deepEqual(filterCommunityAlerts(alerts, {
    category: 'all',
    location: 'all',
    search: '5519',
  }).map((alert) => alert.id), ['A-036']);
  assert.deepEqual(filterCommunityAlerts(alerts, {
    category: 'all',
    location: 'all',
    search: 'passport',
  }).map((alert) => alert.id), ['A-018']);
});

test('community alert filters combine location and category without implying safety', () => {
  const alerts = [alertSummaryFixture, vietnamAlert];
  const result = filterCommunityAlerts(alerts, {
    category: 'upfront-payment',
    location: 'vietnam',
    search: '',
  });
  assert.deepEqual(result.map((alert) => alert.id), ['A-036']);
  assert.equal(filterCommunityAlerts(alerts, {
    category: 'identity-document',
    location: 'regional',
    search: '',
  }).length, 0);
});

test('alert model exposes every deterministic static detail path and UTC review dates', () => {
  assert.deepEqual(ALERT_PROTOTYPE_IDS, ['A-018', 'A-024', 'A-031', 'A-036', 'A-041']);
  assert.equal(formatAlertDate('2026-07-30T02:00:00.000Z'), '30 Jul 2026');
});
