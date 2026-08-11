import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parse } from 'dotenv';

import { loadEnvironment } from '../src/config/env.js';

test('fresh backend setup parses .env.example without private machine state', () => {
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  const environment = loadEnvironment(parse(example));

  assert.equal(environment.PORT, 4000);
  assert.equal(environment.DATABASE_URL, 'postgresql://postgres:postgres@localhost:5433/verify_before_you_go');
  assert.deepEqual(environment.corsOrigins, ['http://localhost:8081', 'http://localhost:19006']);
  assert.ok(Buffer.from(environment.REPORT_SECURITY_SECRET, 'base64url').byteLength >= 32);
});

test('local runbook documents the LAN web CORS origin required by Safari', () => {
  const runbook = readFileSync(new URL('../../../docs/LOCAL_DEVELOPMENT.md', import.meta.url), 'utf8');
  const documentedAddress = /CORS_ORIGINS=http:\/\/localhost:8081,http:\/\/localhost:19006,http:\/\/((?:\d{1,3}\.){3}\d{1,3}):8081/.exec(runbook)?.[1];
  assert.ok(documentedAddress, 'The physical-device setup must include a concrete current LAN address.');
  assert.equal(runbook.includes(`EXPO_PUBLIC_API_BASE_URL=http://${documentedAddress}:4000/api/v1`), true);
  assert.match(runbook, /http:\/\/<LAN-IP>:8081/);
  assert.match(runbook, /address can change whenever the Mac changes Wi-Fi networks/i);
});
