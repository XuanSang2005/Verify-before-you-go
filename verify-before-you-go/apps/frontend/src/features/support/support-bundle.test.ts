import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SupportDirectoryBundleSchema,
  type SupportContactKind,
  type SupportCountry,
} from '@vbyg/contracts';

import { bundledSupportDirectory } from './support-bundle';

test('the production bundle is versioned, contract-valid and contains complete country packs', () => {
  const parsed = SupportDirectoryBundleSchema.parse(bundledSupportDirectory);
  assert.equal(parsed.bundleSchemaVersion, 1);
  assert.match(parsed.availabilityNotice, /verify availability/i);

  for (const country of ['cambodia', 'vietnam'] satisfies SupportCountry[]) {
    const kinds = new Set<SupportContactKind>(
      parsed.response.contacts
        .filter((contact) => contact.country === country)
        .map((contact) => contact.kind),
    );
    assert.ok(kinds.has('emergency'));
    assert.ok(kinds.has('organization'));
    assert.ok(kinds.has('embassy') || kinds.has('consular'));
  }
});

test('the bundled emergency actions use the exact reviewed short codes', () => {
  const emergency = new Map(
    bundledSupportDirectory.response.contacts
      .filter((contact) => contact.kind === 'emergency')
      .map((contact) => [`${contact.country}:${contact.displayValue}`, contact]),
  );

  for (const [key, uri] of [
    ['cambodia:117', 'tel:117'],
    ['cambodia:119', 'tel:119'],
    ['cambodia:1288', 'tel:1288'],
    ['vietnam:113', 'tel:113'],
    ['vietnam:115', 'tel:115'],
    ['vietnam:111', 'tel:111'],
  ]) {
    assert.equal(emergency.get(key)?.actionUri, uri);
    assert.equal(emergency.get(key)?.displayValue, key.split(':')[1]);
  }
});

test('bundle excludes dead CTAs and does not disguise unknown availability as language names', () => {
  const serialized = JSON.stringify(bundledSupportDirectory);
  assert.doesNotMatch(serialized, /lackhmer\.org/i);
  assert.doesNotMatch(serialized, /Confirm with (?:provider|embassy)/i);
  assert.ok(bundledSupportDirectory.response.contacts.every((contact) =>
    contact.languageStatus === 'confirmed' || contact.languages.length === 0));
});

test('bundled embassy switchboard uses neutral source-supported wording', () => {
  const embassy = bundledSupportDirectory.response.contacts.find(
    (contact) => contact.id === 'support-cambodia-vietnam-embassy',
  );
  assert.equal(embassy?.title, 'Vietnamese Embassy switchboard');
  assert.equal(embassy?.description, 'General contact number listed by the Embassy of Viet Nam in Cambodia.');
  assert.equal(embassy?.actionLabel, 'Call the embassy');
});
