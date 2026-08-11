import assert from 'node:assert/strict';
import test from 'node:test';

import type { AlertDetail } from '@vbyg/contracts';

import type { AlertsRepository } from '../src/modules/alerts/alerts.repository.js';
import { seedCommunityAlerts } from '../src/modules/alerts/alerts.seed-data.js';
import {
  getCommunityAlert,
  InvalidPublicAlertDataError,
  listCommunityAlerts,
} from '../src/modules/alerts/alerts.service.js';

const validAlert: AlertDetail = {
  ...seedCommunityAlerts[0]!,
  syntheticLabel: 'Synthetic demo data',
  safetyStatement: 'This reviewed record is not a verdict and does not establish fraud.',
  firstReportedAt: seedCommunityAlerts[0]!.firstReportedAt.toISOString(),
  reviewedAt: seedCommunityAlerts[0]!.reviewedAt.toISOString(),
};

function repositoryWithIdentifier(identifier: string): AlertsRepository {
  const alert = { ...validAlert, maskedIdentifiers: [identifier] };
  return {
    list: async () => [alert],
    findById: async () => alert,
  };
}

test('list service rejects weak masks, trailing padding and mixed Unicode bypasses generically', async () => {
  for (const identifier of [
    'person@example.test********',
    '@visible-handle•*•*',
    '+1 ** 1234',
    '+84 •• 731',
    '+855 ** 408',
  ]) {
    await assert.rejects(
      () => listCommunityAlerts(repositoryWithIdentifier(identifier), {}),
      (error: unknown) => {
        assert.ok(error instanceof InvalidPublicAlertDataError);
        assert.doesNotMatch(error.message, new RegExp(identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        return true;
      },
    );
  }
});

test('detail service rejects weak masks, padded phone and alternate Unicode masks generically', async () => {
  for (const identifier of [
    '+855123456789••••••',
    '@visible●•*•',
    '+1 ** 1234',
    '+84 •• 731',
    '+855 ** 408',
  ]) {
    await assert.rejects(
      () => getCommunityAlert(repositoryWithIdentifier(identifier), 'A-018'),
      (error: unknown) => {
        assert.ok(error instanceof InvalidPublicAlertDataError);
        assert.doesNotMatch(error.message, /855123456789|visible/);
        return true;
      },
    );
  }
});
