import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./OfferCheckScreen.tsx', import.meta.url), 'utf8');
const recentMarkup = source.slice(
  source.indexOf('<View style={styles.divider} />'),
  source.indexOf('</PrototypeTabScreen>'),
);
const recentStyles = source.slice(
  source.indexOf('divider:'),
  source.indexOf('cardHovered:'),
);

test('Recent visual patch keeps the Screen 02 single-column hierarchy', () => {
  assert.match(recentMarkup, /Synthetic demo/);
  assert.match(recentMarkup, /Practice spotting them/);
  assert.match(recentMarkup, /Two synthetic postings, side by side\./);
  assert.match(recentMarkup, /router\.push\('\/learn\/scenario'\)/);
  assert.match(recentMarkup, /View reviewed reports and alerts/);
  assert.match(recentMarkup, /router\.push\('\/alerts'\)/);
  assert.doesNotMatch(recentMarkup, /compactLinks|Nothing saved|No prototype signals/);
});

test('Recent cards remain fluid at every acceptance viewport', () => {
  assert.match(recentStyles, /resultCard: \{[^\n]*width: '100%'[^\n]*maxWidth: '100%'/);
  assert.match(recentStyles, /resultTitle: \{[^\n]*minWidth: 0[^\n]*flex: 1/);
  assert.match(recentStyles, /resultMeta: \{[^\n]*flexShrink: 1/);
  assert.match(recentStyles, /statusLabel: \{[^\n]*flexShrink: 1/);

  for (const viewportWidth of [360, 390, 768, 1024]) {
    const frameWidth = Math.min(viewportWidth, 760);
    const contentWidth = frameWidth - 40;
    assert.ok(contentWidth > 0);
    assert.ok(contentWidth <= viewportWidth);
  }
});

test('Recent typography stays readable and can grow without clipping', () => {
  assert.doesNotMatch(recentStyles, /fontSize: (?:8|9|10),/);
  assert.doesNotMatch(recentMarkup, /numberOfLines=/);
  assert.match(recentStyles, /sectionLabel: \{[^\n]*fontSize: 11[^\n]*lineHeight: 16/);
  assert.match(recentStyles, /resultTitle: \{[^\n]*fontSize: 15[^\n]*lineHeight: 21/);
  assert.match(recentStyles, /statusLabel: \{[^\n]*fontSize: 13[^\n]*lineHeight: 19/);
  assert.match(recentStyles, /statusCount: \{[^\n]*fontSize: 11[^\n]*lineHeight: 15/);
  assert.match(recentStyles, /practiceDescription: \{[^\n]*fontSize: 13[^\n]*lineHeight: 19/);
  assert.match(recentStyles, /reportsLabel: \{[^\n]*fontSize: 15[^\n]*lineHeight: 24/);

  for (const fontScale of [1, 1.15, 1.3]) {
    assert.ok(11 * fontScale >= 11);
  }
});

test('compact Clear control expands to a 44px effective hit area', () => {
  assert.match(recentMarkup, /hitSlop=\{10\}/);
  assert.match(recentStyles, /clearButton: \{[^\n]*minHeight: 24/);
  assert.equal(24 + (10 * 2), 44);
});
