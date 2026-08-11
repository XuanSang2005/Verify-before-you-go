import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const experienceSource = readFileSync(new URL('./OfferPreviewExperience.tsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('./OfferPreviewScreen.tsx', import.meta.url), 'utf8');

test('preview uses the exact unmodified Screen 03 mascot asset', () => {
  const mascot = readFileSync(new URL('../../../assets/mascots/screen03-analysis.jpg', import.meta.url));
  assert.equal(
    createHash('sha256').update(mascot).digest('hex'),
    'ad4a34f1006e87c675da1268a1067a0fa4055230a278a8570b90d3ce1b068964',
  );
  assert.match(screenSource, /screen03-analysis\.jpg/);
  assert.doesNotMatch(screenSource + experienceSource, /analyse-laptop/i);
});

test('preview keeps the compact Screen 03 hierarchy and measured clipped scan treatment', () => {
  assert.match(experienceSource, /padding: 18, borderWidth: 1, borderColor: colors\.line, borderRadius: 12/);
  assert.match(experienceSource, /scanSheet: \{[^\n]*overflow: 'hidden'/);
  assert.match(experienceSource, /onLayout=.*setScanSheetHeight/);
  assert.match(experienceSource, /duration: 2_600/);
  assert.match(experienceSource, /Easing\.bezier\(0\.65, 0, 0\.35, 1\)/);
  assert.match(experienceSource, /backgroundColor: colors\.brightBlue/);
  assert.match(experienceSource, /backgroundColor: colors\.paleBlue/);
  assert.match(experienceSource, /height: 5, gap: 3/);
  assert.match(experienceSource, /width: 268/);
  assert.match(experienceSource, /height: 172/);
});

test('preview has no tiny visible type, truncation or old dashboard hierarchy', () => {
  const fontSizes = [...experienceSource.matchAll(/fontSize:\s*(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(fontSizes.length > 0);
  assert.equal(fontSizes.every((fontSize) => fontSize >= 11), true);
  assert.doesNotMatch(experienceSource, /numberOfLines|ellipsizeMode/);
  assert.doesNotMatch(experienceSource, /Review before analysis|Step 2 of 2|Nothing has been scored|Session-only preview|ActivityIndicator/);
});

test('screenshot disclosure is exact and the screenshot pixels are never placed in the scan sheet', () => {
  assert.match(experienceSource, /Screenshot attached · no text extracted or uploaded/);
  assert.doesNotMatch(experienceSource, /No OCR|OCR has been performed|source=\{\{ uri: draft\.screenshot\.uri/);
});

test('successful preview navigation replaces history and never pushes a stale result route', () => {
  assert.match(screenSource, /router\.replace\('\/check\/result'\)/);
  assert.doesNotMatch(screenSource, /router\.push\('\/check\/result'\)/);
});
