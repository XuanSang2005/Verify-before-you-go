import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { STARTUP_ONBOARDING_CARDS } from './onboarding-content';
import {
  STARTUP_ONBOARDING_CARD_ONE_IMAGE,
  STARTUP_ONBOARDING_CARD_THREE_IMAGE,
  STARTUP_ONBOARDING_CARD_TWO_IMAGE,
} from './onboarding-image-data';

function hashDataUri(value: string) {
  return createHash('sha256').update(Buffer.from(value.split(',')[1] ?? '', 'base64')).digest('hex');
}

test('startup onboarding keeps the three requested cards without the removed footer notes', () => {
  assert.deepEqual(STARTUP_ONBOARDING_CARDS.map(({ id }) => id), ['observe', 'decide', 'help']);
  const copy = JSON.stringify(STARTUP_ONBOARDING_CARDS);
  assert.match(copy, /No verdict, no score, no accusation/u);
  assert.match(copy, /Help works without an account/u);
  assert.doesNotMatch(copy, /Findings are counted|The job might be real|No account, no email/u);
});

test('startup onboarding uses the three exact illustrations from Original HTML Screen 01', () => {
  assert.equal(hashDataUri(STARTUP_ONBOARDING_CARD_ONE_IMAGE), '8c3536b00b349b27674ae8ee32a29679c957953c7915f9f43c704ac8a91f4bb3');
  assert.equal(hashDataUri(STARTUP_ONBOARDING_CARD_TWO_IMAGE), 'd6bf9d9bed20a825578a2a17cdf00349c615f37c6df7a81a6cba5c1ff944c122');
  assert.equal(hashDataUri(STARTUP_ONBOARDING_CARD_THREE_IMAGE), '53a6905e6ab5ff88a0f983fb937a228ab602d7c7300f1afbc95d7862d65bf89f');
});

test('startup onboarding has no persistence or account gate', () => {
  const source = readFileSync(new URL('./StartupOnboardingGate.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /AsyncStorage|SecureStore|localStorage|sessionStorage|fetch\(/u);
  assert.match(source, /useState\(true\)/u);
});
