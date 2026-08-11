import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectRoot = new URL('../../../', import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, projectRoot), 'utf8');
}

test('canonical share routes live in the floating five-tab shell', () => {
  const tabsLayout = source('app/(tabs)/_layout.tsx');
  const previewRoute = source('app/(tabs)/share/preview.tsx');
  const recipientRoute = source('app/(tabs)/share/recipient.tsx');
  const legacyAlias = source('app/check/share.tsx');

  assert.match(tabsLayout, /primaryTabRouteNames = \['index', 'check', 'news', 'quiz', 'help'\]/);
  assert.match(tabsLayout, /name="share"[\s\S]*?href: null/);
  assert.match(previewRoute, /SharePreviewScreen/);
  assert.match(recipientRoute, /ShareRecipientScreen/);
  assert.match(legacyAlias, /Redirect href="\/share\/preview"/);
});

test('CP12 remains frontend-only and never persists private evidence', () => {
  const implementation = [
    source('src/features/share/SharePreviewScreen.tsx'),
    source('src/features/share/ShareRecipientScreen.tsx'),
    source('src/features/share/share-model.ts'),
    source('src/features/share/share-service.ts'),
    source('src/features/share/share-runtime.ts'),
  ].join('\n');

  assert.doesNotMatch(implementation, /fetch\(|axios|AsyncStorage|SecureStore|postingText|markedPassages|screenshotNote|analysisId|reportId|recoveryKey/);
  assert.match(implementation, /full identifiers/i);
  assert.match(implementation, /original screenshot/i);
});
