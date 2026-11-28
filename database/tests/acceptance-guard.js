import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MongoClient } from 'mongodb';

// Deliberately separate from QA guards. Never accepts a database prefix.
export async function acceptanceGuard({ write = false } = {}) {
  const database = process.env.MONGODB_DB_NAME;
  assert.equal(database, 'cinema_management', 'Acceptance requires the exact official DB name');
  const base = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:3000';
  const url = new URL(base);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Local API only');
  const health = await fetch(base + '/api/health').then(r => r.json());
  assert.equal(health.database, database, 'API/DB mismatch; no writes allowed');
  if (write) {
    assert.equal(process.env.ACCEPTANCE_CONFIRM, 'WRITE cinema_management', 'Explicit confirmation required');
    assert(process.env.ACCEPTANCE_BACKUP_MANIFEST, 'Backup manifest required');
    const manifest = JSON.parse((await readFile(process.env.ACCEPTANCE_BACKUP_MANIFEST, 'utf8')).replace(/^\uFEFF/, ''));
    assert.equal(manifest.database, database);
    assert.equal(manifest.dryRun, true);
    const archive = await readFile(manifest.archive);
    assert.equal((await stat(manifest.archive)).size, manifest.bytes);
    assert(manifest.bytes > 0);
    assert.equal(createHash('sha256').update(archive).digest('hex').toLowerCase(), manifest.sha256.toLowerCase());
    assert(process.env.MONGORESTORE_PATH, 'MONGORESTORE_PATH required');
    execFileSync(process.env.MONGORESTORE_PATH, ['--archive=' + manifest.archive, '--gzip', '--dryRun', '--nsInclude=cinema_management.*'], { stdio: 'pipe' });
  }
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  return { database, base: base.replace(/\/$/, ''), client, db: client.db(database) };
}
