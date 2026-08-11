import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const draftRoute = readFileSync(new URL('../../../app/(tabs)/reports/new.tsx', import.meta.url), 'utf8');
const privacyRoute = readFileSync(new URL('../../../app/(tabs)/reports/privacy.tsx', import.meta.url), 'utf8');
const receiptRoute = readFileSync(new URL('../../../app/(tabs)/reports/receipt.tsx', import.meta.url), 'utf8');
const tabLayout = readFileSync(new URL('../../../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const draftScreen = readFileSync(new URL('./ReportDraftScreen.tsx', import.meta.url), 'utf8');

test('canonical CP10-CP11 routes render inside the shared tab shell without a sixth visible tab', () => {
  assert.match(draftRoute, /ReportDraftScreen/);
  assert.match(privacyRoute, /ReportPrivacyScreen/);
  assert.match(receiptRoute, /ReportReceiptScreen/);
  assert.match(tabLayout, /name="reports"[\s\S]*href: null/);
  assert.deepEqual([...tabLayout.matchAll(/tabBarAccessibilityLabel:/g)].length, 5);
});

test('direct receipt route has an honest missing-session state instead of a fabricated receipt', () => {
  const receiptScreen = readFileSync(new URL('./ReportReceiptScreen.tsx', import.meta.url), 'utf8');
  assert.match(receiptScreen, /if \(!submission\.receipt\)/u);
  assert.match(receiptScreen, /No receipt in this session\./u);
  assert.match(receiptScreen, /No case ID or recovery key has been generated/u);
});

test('CP10 report draft performs no API request or backend submission', () => {
  assert.doesNotMatch(draftScreen, /\bfetch\s*\(|from ['"]@\/api|\/api\/v1|submitReport/);
  assert.match(draftScreen, /Nothing is submitted in this step/);
});

test('report evidence remove and privacy switch controls retain 48px touch targets', () => {
  const privacyScreen = readFileSync(new URL('./ReportPrivacyScreen.tsx', import.meta.url), 'utf8');
  assert.match(draftScreen, /removeEvidence: \{ width: 48, height: 48/);
  assert.match(privacyScreen, /switchTarget: \{ width: 48, height: 48/);
});
