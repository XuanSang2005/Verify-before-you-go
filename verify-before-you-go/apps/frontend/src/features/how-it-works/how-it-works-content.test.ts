import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { deviceAndServerFacts, howItWorksLinks, howItWorksSteps } from './how-it-works-content';

test('CP15 covers analysis, no-verdict language and independent verification in three Screen 01 steps', () => {
  assert.deepEqual(howItWorksSteps.map((step) => step.number), ['01', '02', '03']);
  const copy = JSON.stringify(howItWorksSteps);
  assert.match(copy, /submitted posting text and URL text/u);
  assert.match(copy, /count, not a score or a prediction/u);
  assert.match(copy, /safe or fraudulent/u);
  assert.match(copy, /source you found separately/u);
});

test('CP15 truthfully distinguishes local data from deliberate backend actions', () => {
  assert.deepEqual(deviceAndServerFacts.map((fact) => fact.id), ['device', 'server']);
  const copy = JSON.stringify(deviceAndServerFacts);
  assert.match(copy, /Evidence images stay on this device and are not uploaded/u);
  assert.match(copy, /secure device storage/u);
  assert.match(copy, /native automatically attempts to save a delivered recovery key in secure device storage, and the receipt reports whether this succeeded/u);
  assert.match(copy, /Web does not save it automatically; copy or download it, or enter it again later/u);
  assert.match(copy, /full identifier, factual description, selected behaviours, privacy choices and redacted preview/u);
  assert.match(copy, /server encrypts the private identifier and description/u);
  assert.match(copy, /public redacted derivative is stored only when you enable the corresponding permission/u);
  assert.match(copy, /API receives submitted posting text, URL text and screenshotProvided for transient analysis/u);
  assert.match(copy, /Screenshot pixels are not uploaded, OCR’d or analysed, and check content is not persisted/u);
});

test('CP15 reuses the exact first illustration bytes embedded in Original HTML Screen 01', () => {
  const illustration = readFileSync(
    new URL('../../../assets/mascots/alerts-guide-screen12.jpg', import.meta.url),
  );
  assert.equal(
    createHash('sha256').update(illustration).digest('hex'),
    '8c3536b00b349b27674ae8ee32a29679c957953c7915f9f43c704ac8a91f4bb3',
  );
});

test('CP15 exposes only the required Home, Check and Help destinations', () => {
  assert.deepEqual(howItWorksLinks.map((link) => link.href), ['/', '/check', '/help']);
});

test('How It Works is a hidden route inside the approved five-tab shell, not an onboarding gate or sixth tab', () => {
  const layoutSource = readFileSync(new URL('../../../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const routeSource = readFileSync(new URL('../../../app/(tabs)/how-it-works.tsx', import.meta.url), 'utf8');
  const screenSource = readFileSync(new URL('./HowItWorksScreen.tsx', import.meta.url), 'utf8');

  assert.match(layoutSource, /primaryTabRouteNames = \['index', 'check', 'news', 'quiz', 'help'\]/u);
  assert.match(layoutSource, /routeName === 'index' \|\| routeName === 'how-it-works'/u);
  assert.match(layoutSource, /name="how-it-works"[\s\S]*?options=\{\{ href: null \}\}/u);
  assert.doesNotMatch(layoutSource, /primaryTabRouteNames = \[[^\]]*how-it-works/u);
  assert.match(routeSource, /HowItWorksScreen/u);
  assert.doesNotMatch(routeSource, /onboardingComplete|redirect|AsyncStorage/u);
  assert.doesNotMatch(screenSource, /fetch\(|AsyncStorage|SecureStore|useEffect/u);
});
