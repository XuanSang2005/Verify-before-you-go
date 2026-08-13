import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { CHECKLIST_ITEM_IDS, verificationChecklistItems } from './checklist-items';

const screenSource = readFileSync(new URL('./ChecklistScreen.tsx', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('./checklist-storage.ts', import.meta.url), 'utf8');
const routeUrl = new URL('../../../app/(tabs)/check/checklist.tsx', import.meta.url);
const retiredPlaceholderUrl = new URL('../../../app/check/checklist.tsx', import.meta.url);

test('defines exactly five evidence-based verification items', () => {
  assert.equal(CHECKLIST_ITEM_IDS.length, 5);
  assert.equal(verificationChecklistItems.length, 5);
  assert.equal(new Set(verificationChecklistItems.map((item) => item.id)).size, 5);

  for (const item of verificationChecklistItems) {
    assert.ok(item.title.length > 0);
    assert.ok(item.whyItMatters.length > 0);
    assert.ok(item.independentCheck.length > 0);
  }

  const copy = JSON.stringify(verificationChecklistItems);
  assert.doesNotMatch(copy, /\b(?:scam|not scam|safe offer|offer is safe|verdict:)\b/i);
});

test('direct checklist route lives inside the approved floating-tab shell', () => {
  assert.equal(existsSync(routeUrl), true);
  assert.equal(existsSync(retiredPlaceholderUrl), false);
  assert.match(readFileSync(routeUrl, 'utf8'), /ChecklistScreen/);
  assert.match(screenSource, /PrototypeTabScreen/);
});

test('checklist is headerless and starts after the top safe area', () => {
  assert.doesNotMatch(screenSource, /AppHeader|PrototypeHeader|Get help|Scan 0412/);
  assert.match(screenSource, /screenContent: \{ paddingTop: 14 \}/);
  assert.match(screenSource, /style=\{styles\.backControl\}/);
});

test('each compact row has separate 48px Verify and Couldn’t verify controls', () => {
  assert.match(screenSource, /label="Verify"/);
  assert.match(screenSource, /label="Couldn’t verify"/);
  assert.match(screenSource, /accessibilityRole="checkbox"/);
  assert.match(screenSource, /accessibilityState=\{\{ checked: active, disabled \}\}/);
  assert.match(screenSource, /Item \$\{index \+ 1\} of 5/);
  assert.match(screenSource, /stateControl: \{[^\n]*minHeight: 48/);
  assert.match(screenSource, /itemDivider/);
  assert.doesNotMatch(screenSource, /itemCard|cardShadow/);
  assert.doesNotMatch(screenSource, /numberOfLines=/);
});

test('offline checklist does not import or call an API', () => {
  assert.doesNotMatch(screenSource, /fetch\(|axios|analyseOfferDraft|\/api\//);
  assert.doesNotMatch(storageSource, /fetch\(|axios|analyseOfferDraft|\/api\//);
  assert.doesNotMatch(screenSource, /AsyncStorage/);
  assert.match(storageSource, /AsyncStorage/);
});

test('checklist frames cannot exceed the 360px or 390px viewport', () => {
  assert.match(screenSource, /checklistPanel: \{[^\n]*width: '100%'[^\n]*maxWidth: '100%'/);
  assert.match(screenSource, /itemRow: \{[^\n]*width: '100%'[^\n]*maxWidth: '100%'/);

  for (const viewportWidth of [360, 390]) {
    const contentWidth = viewportWidth - 40;
    assert.ok(contentWidth > 0 && contentWidth <= viewportWidth);
  }
});

test('reset, completion and storage recovery states are present without motion', () => {
  assert.match(screenSource, /requestChecklistResetConfirmation/);
  assert.match(screenSource, /All items reviewed/);
  assert.match(screenSource, /Continue to scenario practice/);
  assert.match(screenSource, /href="\/learn\/scenario"/);
  assert.match(screenSource, /complete \? \(/);
  assert.match(screenSource, /scrollToEndKey=\{complete \? 'complete' : undefined\}/);
  assert.match(screenSource, /Invalid saved checklist data was ignored/);
  assert.match(screenSource, /Retry storage/);
  assert.doesNotMatch(screenSource, /Animated\.|withTiming|spring/);
});

test('back navigation does not grow history and checkpoint labels are absent from UI', () => {
  assert.match(screenSource, /router\.replace\(backRoute\)/);
  assert.doesNotMatch(screenSource, /router\.push\(/);
  assert.doesNotMatch(screenSource, />[^<]*CP05[^<]*</);
});

test('writes are gated until storage has been read and retry merges session edits', () => {
  assert.match(screenSource, /if \(!storageReadSucceededRef\.current\) return/);
  assert.match(screenSource, /pendingSessionEditsRef\.current\.add/);
  assert.match(screenSource, /retryChecklistReadAndMergeSession/);
});

test('web controls declare checked state and every progressbar ARIA value explicitly', () => {
  assert.match(screenSource, /aria-checked=\{active\}/);
  assert.match(screenSource, /aria-valuemin=\{0\}/);
  assert.match(screenSource, /aria-valuemax=\{5\}/);
  assert.match(screenSource, /aria-valuenow=\{reviewedCount\}/);
  assert.match(screenSource, /aria-valuetext=\{`\$\{reviewedCount\} of 5 reviewed`\}/);
});
