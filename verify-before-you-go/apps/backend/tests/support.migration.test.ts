import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../prisma/migrations/20260812193000_cp14_retire_dead_legal_aid/migration.sql',
  import.meta.url,
);

test('deployment migration retires the dead Legal Aid row without requiring seed', async () => {
  const migration = await readFile(migrationUrl, 'utf8');
  assert.match(migration, /UPDATE\s+"SupportContact"/i);
  assert.match(migration, /"isActive"\s*=\s*false/i);
  assert.match(migration, /"id"\s*=\s*'support-cambodia-legal-aid'/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});
