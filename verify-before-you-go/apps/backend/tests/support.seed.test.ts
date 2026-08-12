import assert from 'node:assert/strict';
import test from 'node:test';

import { seedSupportContacts } from '../src/modules/support/support.seed-data.js';
import {
  reconcileSupportDirectorySeed,
  type SupportSeedPort,
} from '../src/modules/support/support.seed.js';

test('support seed reconciles retired rows and excludes dead actions from active data', async () => {
  const upserts: string[] = [];
  const deactivated: string[] = [];
  const port: SupportSeedPort = {
    supportContact: {
      async upsert(write) {
        upserts.push(write.where.id);
      },
      async updateMany(write) {
        deactivated.push(...write.where.id.in);
      },
    },
  };

  await reconcileSupportDirectorySeed(port);
  assert.equal(upserts.length, seedSupportContacts.length);
  assert.ok(deactivated.includes('support-cambodia-legal-aid'));
  assert.ok(!upserts.includes('support-cambodia-legal-aid'));
  assert.doesNotMatch(JSON.stringify(seedSupportContacts), /lackhmer\.org/i);
});
