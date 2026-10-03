// Run explicitly with: node --env-file=/path/to/private.env tests/neon-forms.integration.mjs
// Uses a temporary schema and refuses to run account operations in public.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon, neonConfig } from '@neondatabase/serverless';
import { getDatabase } from '../lib/server-database.js';
import { createUser, findUser, listManagedUsers } from '../lib/auth/store.js';
import { readUserForms, saveUserForm, confirmScreening } from '../lib/forms/store.js';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('[SENSITIVE]')) throw new Error('A database connection is required');
const originalUrl = process.env.DATABASE_URL;
const admin = neon(originalUrl);
const schema = `cogni_test_${randomUUID().replaceAll('-', '')}`;
const originalFetch = neonConfig.fetchFunction;
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  // Neon HTTP ignores the connection URL's search_path option. Every test call
  // executes SET LOCAL and its SQL in one transaction, including schema upgrades.
  neonConfig.fetchFunction = async (endpoint, options) => {
    const payload = JSON.parse(options.body);
    const response = await (originalFetch || fetch)(endpoint, { ...options,
      body: JSON.stringify({ queries: [{ query: `SET LOCAL search_path TO ${schema}`, params: [] }, ...(payload.queries || [payload])] }),
    });
    if (!response.ok) return response;
    const data = await response.json();
    return Response.json(payload.queries ? { results: data.results.slice(1) } : data.results[1]);
  };
  const scoped = neon(originalUrl);
  assert.equal((await scoped`SELECT current_schema() AS schema`)[0].schema, schema, 'Temporary schema isolation is required');
  // Seed an older schema to exercise signup-order backfill, then upgrade it.
  await scoped`CREATE TABLE cogniload_users (email TEXT PRIMARY KEY, name TEXT, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', created_at TEXT, login_count INTEGER NOT NULL DEFAULT 0, last_login_at TEXT)`;
  for (const [email, date] of [['later@test.invalid', '2026-02-01'], ['first@test.invalid', '2026-01-01']]) {
    await scoped`INSERT INTO cogniload_users (email, password_hash, created_at) VALUES (${email}, 'test-hash', ${date})`;
  }
  await getDatabase();
  assert.equal((await findUser('first@test.invalid')).participantId, 'P001');
  assert.equal((await findUser('later@test.invalid')).participantId, 'P002');
  const accounts = Array.from({ length: 6 }, (_, index) => ({ email: `user${index}@test.invalid`, name: 'Test', passwordHash: 'test-hash', createdAt: new Date().toISOString(), role: 'user' }));
  await Promise.all(accounts.map(createUser));
  const listed = await listManagedUsers();
  assert.equal(new Set(listed.map((user) => user.participantId)).size, 8);
  const email = accounts[0].email;
  const participantId = (await findUser(email)).participantId;
  const setup = { participant: participantId, sessionId: 'S07', studyGroup: 'control', condition: 'comparison', taskSeconds: 75, consent: true, markerText: 'note', baselineSeconds: 30, postTaskSeconds: 30, protocolVersion: 'test' };
  await saveUserForm(email, 'setup', setup);
  await saveUserForm(email, 'workspace', { fields: { age: '68', date: '2026-10-03' }, journey: { step: 2 }, history: [] });
  const submission = { id: randomUUID(), acknowledged: true, respondent: 'self', answers: Array(8).fill('unchanged') };
  const first = await confirmScreening(email, submission, participantId);
  assert.deepEqual(await confirmScreening(email, submission, participantId), first);
  await Promise.all(Array.from({ length: 3 }, () => confirmScreening(email, { ...submission, id: randomUUID() }, participantId)));
  const restored = await readUserForms(email);
  assert.deepEqual(restored.setup, setup);
  assert.equal(Object.keys(restored.screeningHistory).length, 4);
  assert.equal(restored.workspace.fields.age, '68');
  assert.deepEqual(await readUserForms(accounts[1].email), {});
  console.log('PASS: real Neon schema upgrade, signup order, concurrent IDs, persistent forms, idempotent screening history and account isolation');
} catch (error) {
  console.error(error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
} finally {
  process.env.DATABASE_URL = originalUrl;
  neonConfig.fetchFunction = originalFetch;
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
}
