import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AlertsApiError,
  fetchCommunityAlert,
  fetchCommunityAlerts,
  type AlertsFetch,
} from './alerts';
import {
  alertDetailFixture,
  alertListFixture,
} from '../features/alerts/alerts-test-fixtures';

test('alerts API client sends canonical list filters and validates masked summaries', async () => {
  let requestedUrl = '';
  const fetchImpl: AlertsFetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(alertListFixture), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const response = await fetchCommunityAlerts({
    search: 'passport',
    location: 'cambodia',
    category: 'off-platform-contact',
  }, fetchImpl);

  assert.match(requestedUrl, /\/alerts\?search=passport&location=cambodia&category=off-platform-contact$/);
  assert.equal(response.alerts[0]?.maskedIdentifiers[0], '@••••••2026');
});

test('alerts detail client validates evidence, unknowns and verification guidance', async () => {
  const fetchImpl: AlertsFetch = async () => new Response(JSON.stringify(alertDetailFixture), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  const response = await fetchCommunityAlert('A-018', fetchImpl);
  assert.equal(response.alert.verificationSteps.length, 3);
  assert.match(response.alert.safetyStatement, /not a verdict/i);
});

test('alerts API client distinguishes network, HTTP and invalid-response errors', async () => {
  const networkFailure: AlertsFetch = async () => { throw new Error('offline'); };
  await assert.rejects(
    () => fetchCommunityAlerts({}, networkFailure),
    (error) => error instanceof AlertsApiError && error.kind === 'network',
  );

  const httpFailure: AlertsFetch = async () => new Response(JSON.stringify({
    error: { code: 'COMMUNITY_ALERT_NOT_FOUND', message: 'Not found.', requestId: 'request-1' },
  }), { status: 404, headers: { 'content-type': 'application/json' } });
  await assert.rejects(
    () => fetchCommunityAlert('A-999', httpFailure),
    (error) => error instanceof AlertsApiError
      && error.kind === 'http'
      && error.status === 404
      && error.code === 'COMMUNITY_ALERT_NOT_FOUND',
  );

  const invalidResponse: AlertsFetch = async () => new Response(JSON.stringify({ alerts: 'invalid' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(
    () => fetchCommunityAlerts({}, invalidResponse),
    (error) => error instanceof AlertsApiError && error.kind === 'invalid-response',
  );
});
