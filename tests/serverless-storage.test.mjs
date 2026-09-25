import test from "node:test";
import assert from "node:assert/strict";
import { neonConfig } from "@neondatabase/serverless";
import { getDatabase } from "../lib/server-database.js";
import { createUser, findUser, recordLogin } from "../lib/auth/store.js";
import { clientKey, rateLimit } from "../lib/auth/rate-limit.js";
import { saveResearchRecord, listParticipants, listParticipantRecords } from "../lib/research/server-store.js";
import { getEffectiveStudyConfig, resetStudyConfig, saveStudyConfig } from "../lib/research/study-settings-store.js";

function result(names = [], values = [], types = []) {
  return Response.json({
    command: "SELECT",
    rowCount: values.length,
    rows: values,
    fields: names.map((name, index) => ({ name, dataTypeID: types[index] || 25 })),
  });
}

test("serverless storage uses parameterized Neon queries for accounts, summaries and settings", async () => {
  const oldUrl = process.env.DATABASE_URL;
  const oldVercel = process.env.VERCEL;
  const oldFetch = neonConfig.fetchFunction;
  const users = new Map();
  const records = new Map();
  const settings = new Map();
  const rateBuckets = new Map();
  const queries = [];
  process.env.DATABASE_URL = "postgresql://test:test@fake.neon.tech/test?sslmode=require";
  process.env.VERCEL = "1";
  neonConfig.fetchFunction = async (_url, options) => {
    const { query, params } = JSON.parse(options.body);
    queries.push({ query, params });
    if (query.startsWith("CREATE ")) return result();
    if (query.startsWith("INSERT INTO cogniload_users")) {
      const [email, name, password_hash, created_at] = params;
      if (users.has(email)) return result(["email"]);
      users.set(email, { email, name, password_hash, created_at, login_count: 0, last_login_at: null });
      return result(["email"], [[email]]);
    }
    if (query.startsWith("SELECT * FROM cogniload_users")) {
      const row = users.get(params[0]);
      const names = ["email", "name", "password_hash", "created_at", "login_count", "last_login_at"];
      return result(names, row ? [names.map((name) => row[name])] : [], [25, 25, 25, 25, 23, 25]);
    }
    if (query.startsWith("UPDATE cogniload_users")) {
      const row = users.get(params[1]);
      const names = ["email", "name", "password_hash", "created_at", "login_count", "last_login_at"];
      if (!row) return result(names);
      row.login_count++;
      row.last_login_at = params[0];
      return result(names, [names.map((name) => row[name])], [25, 25, 25, 25, 23, 25]);
    }
    if (query.startsWith("INSERT INTO cogniload_research_records")) {
      const [recordId, participantId, uploadedBy, uploadedAt, summary] = params;
      const existing = records.get(recordId);
      if (existing && (existing.participantId !== participantId || existing.uploadedBy !== uploadedBy)) return result(["uploaded_at"]);
      records.set(recordId, { recordId, participantId, uploadedBy, uploadedAt: existing?.uploadedAt || uploadedAt, summary: JSON.parse(summary) });
      return result(["uploaded_at"], [[existing?.uploadedAt || uploadedAt]]);
    }
    if (query.startsWith("SELECT participant_id AS id")) {
      const counts = new Map();
      for (const row of records.values()) if (row.participantId.toLowerCase().includes(params[0].toLowerCase())) counts.set(row.participantId, (counts.get(row.participantId) || 0) + 1);
      return result(["id", "session_count"], [...counts].map(([id, count]) => [id, count]), [25, 23]);
    }
    if (query.startsWith("SELECT record_id, participant_id")) {
      const names = ["record_id", "participant_id", "uploaded_by", "uploaded_at", "summary"];
      const matching = [...records.values()].filter((row) => row.participantId === params[0]);
      return result(names, matching.map((row) => [row.recordId, row.participantId, row.uploadedBy, row.uploadedAt, JSON.stringify(row.summary)]), [25, 25, 25, 25, 3802]);
    }
    if (query.startsWith("SELECT value FROM cogniload_settings")) return result(["value"], settings.has("study") ? [[JSON.stringify(settings.get("study"))]] : [], [3802]);
    if (query.startsWith("INSERT INTO cogniload_settings")) { settings.set("study", JSON.parse(params[0])); return result(); }
    if (query.startsWith("DELETE FROM cogniload_settings")) { settings.delete("study"); return result(); }
    if (query.startsWith("INSERT INTO cogniload_rate_limits")) {
      const [key, resetAt, now] = params;
      const existing = rateBuckets.get(key);
      const bucket = !existing || existing.resetAt <= now ? { count: 1, resetAt } : { count: existing.count + 1, resetAt: existing.resetAt };
      rateBuckets.set(key, bucket);
      return result(["count", "reset_at"], [[bucket.count, bucket.resetAt]], [23, 20]);
    }
    throw new Error(`Unexpected SQL: ${query}`);
  };
  try {
    const email = "operator@example.org";
    const user = { email, name: "Operator", passwordHash: "hashed", createdAt: new Date().toISOString() };
    assert.equal((await createUser(user)).ok, true);
    assert.equal((await createUser(user)).ok, false);
    assert.equal((await findUser(email)).passwordHash, "hashed");
    assert.equal((await recordLogin(email)).loginCount, 1);
    const participantId = "O'Neil-01";
    const submission = { recordId: "record-1", participantId, summary: { startedMs: Date.now(), protocolVersion: "pilot_2" } };
    assert.equal((await saveResearchRecord(submission, email)).ok, true);
    assert.deepEqual(await listParticipants("O'Neil"), [{ id: participantId, sessionCount: 1 }]);
    assert.equal((await listParticipantRecords(participantId))[0].summary.protocolVersion, "pilot_2");
    assert.deepEqual(await saveResearchRecord(submission, "other@example.org"), { ok: false, reason: "record_conflict" });
    const study = { baselineSeconds: 40, postTaskSeconds: 20, maxTaskSeconds: 300, defaultTaskSeconds: 90, protocolVersion: "pilot_2" };
    await saveStudyConfig(study);
    assert.deepEqual(await getEffectiveStudyConfig(), { study, source: "saved" });
    await resetStudyConfig();
    assert.equal((await getEffectiveStudyConfig()).source, "environment");
    const search = queries.find(({ query }) => query.startsWith("SELECT participant_id AS id"));
    assert.ok(search.params.includes("O'Neil"));
    assert.equal(search.query.includes("O'Neil"), false);
    const key = clientKey(new Request("https://example.org/api/auth/login", { headers: { "x-vercel-forwarded-for": "192.0.2.3", "x-forwarded-for": "198.51.100.4" } }), "login");
    assert.equal(key, "login:192.0.2.3");
    assert.equal((await rateLimit(key, 2)).ok, true);
    assert.equal((await rateLimit(key, 2)).ok, true);
    assert.equal((await rateLimit(key, 2)).ok, false);
    assert.equal(queries.filter(({ query }) => query.startsWith("CREATE ")).length, 5);
  } finally {
    neonConfig.fetchFunction = oldFetch;
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    if (oldVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = oldVercel;
  }
});

test("Vercel refuses ephemeral JSON storage when DATABASE_URL is missing", async () => {
  const oldUrl = process.env.DATABASE_URL;
  const oldVercel = process.env.VERCEL;
  delete process.env.DATABASE_URL;
  process.env.VERCEL = "1";
  try {
    await assert.rejects(getDatabase(), { code: "STORAGE_UNAVAILABLE" });
  } finally {
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    if (oldVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = oldVercel;
  }
});
