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

test('CP12 uses only the signed-token API and never persists or sends private evidence', () => {
  const implementation = [
    source('src/api/share.ts'),
    source('src/features/share/SharePreviewScreen.tsx'),
    source('src/features/share/ShareRecipientScreen.tsx'),
    source('src/features/share/share-model.ts'),
    source('src/features/share/share-service.ts'),
    source('src/features/share/share-runtime.ts'),
  ].join('\n');

  assert.match(implementation, /share-tokens/);
  assert.doesNotMatch(implementation, /axios|AsyncStorage|SecureStore|postingText|markedPassages|screenshotNote|analysisId|reportId|recoveryKey/);
  assert.match(implementation, /full identifiers/i);
  assert.match(implementation, /original screenshot/i);
});

test('recipient routes accept only one signed token and render genuine links', () => {
  const model = source('src/features/share/share-model.ts');
  const recipient = source('src/features/share/ShareRecipientScreen.tsx');
  assert.match(model, /keys\.length !== 1 \|\| keys\[0\] !== 'token'/);
  assert.doesNotMatch(model, /params\.(?:v|signals|expires|demo)/);
  assert.doesNotMatch(model, /return \{\s*(?:v|signals|expires|demo):/);
  assert.match(recipient, /<Link asChild href="\/check\/checklist">/);
  assert.match(recipient, /<Link asChild href="\/help">/);
  assert.match(recipient, /<Link asChild href="\/check">/);
});
