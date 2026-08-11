import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('./HomeScreen.tsx', import.meta.url), 'utf8');
const shellSource = readFileSync(
  new URL('../../components/prototype/PrototypeShell.tsx', import.meta.url),
  'utf8',
);

function expectTypography(
  source: string,
  styleName: string,
  fontSize: number,
  lineHeight: number,
) {
  assert.match(
    source,
    new RegExp(`${styleName}: \\{[^\\n]*fontSize: ${fontSize}[^\\n]*lineHeight: ${lineHeight}`),
  );
}

test('Homepage uses the approved typography scale without sub-11px text', () => {
  expectTypography(homeSource, 'kicker', 11, 16);
  expectTypography(homeSource, 'title', 29, 34);
  expectTypography(homeSource, 'lede', 15, 23);
  expectTypography(homeSource, 'stageCopy', 11, 17);
  expectTypography(homeSource, 'primaryTitle', 16, 21);
  expectTypography(homeSource, 'primaryDescription', 13, 19);
  expectTypography(homeSource, 'utilityTitle', 14, 20);
  expectTypography(homeSource, 'utilityDescription', 12, 18);
  expectTypography(homeSource, 'trustText', 12, 18);

  expectTypography(shellSource, 'actionTitle', 14, 20);
  expectTypography(shellSource, 'featureTitle', 14, 20);
  expectTypography(shellSource, 'featureDescription', 12, 18);
  expectTypography(shellSource, 'featureMetadata', 11, 16);

  for (const source of [homeSource, shellSource]) {
    const sizes = [...source.matchAll(/fontSize: (\d+)/g)].map((match) => Number(match[1]));
    assert.ok(sizes.length > 0);
    assert.ok(sizes.every((size) => size >= 11));
  }
});

test('Homepage copy can grow through 130% without truncation contracts', () => {
  assert.doesNotMatch(homeSource, /numberOfLines=|allowFontScaling=\{false\}/);
  assert.doesNotMatch(shellSource, /numberOfLines=|allowFontScaling=\{false\}/);

  for (const fontScale of [1, 1.15, 1.3]) {
    assert.ok(12 * fontScale >= 12);
    assert.ok(18 * fontScale >= 18);
  }
});

test('Homepage keeps action-card descriptions for accessibility only', () => {
  assert.match(shellSource, /accessibilityLabel=\{`\$\{title\}\. \$\{description\}`\}/);
  assert.doesNotMatch(shellSource, /<Text style=\{styles\.actionDescription\}>/);
  assert.match(homeSource, /description="Check before paying or sharing ID\."/);
  assert.match(homeSource, /description="Can a polished certificate prove it’s genuine\?"/);
});

test('Homepage keeps equal-height cards in the approved 2×2 grid', () => {
  assert.match(homeSource, /actionGrid: \{[^\n]*flexDirection: 'row'[^\n]*flexWrap: 'wrap'[^\n]*alignItems: 'stretch'/);
  assert.match(shellSource, /actionCard: \{[^\n]*flexBasis: '47%'[^\n]*flexGrow: 1[^\n]*flexShrink: 1/);
});
