import test from "node:test";
import assert from "node:assert/strict";
import { neonConfig } from "@neondatabase/serverless";
import { getDatabase } from "../lib/server-database.js";
import { createUser, findUser, recordLogin, listManagedUsers, updateManagedUser } from "../lib/auth/store.js";
import { normalizeUserProfile } from "../lib/auth/user-profile.mjs";
import { clientKey, rateLimit } from "../lib/auth/rate-limit.js";
import { saveResearchRecord, listParticipants, listParticipantRecords, listResearchRecords } from "../lib/research/server-store.js";
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
    if (query.startsWith("CREATE ") || query.startsWith("ALTER TABLE ")) return result();
    if (query.startsWith("INSERT INTO cogniload_users")) {
      const [email, name, password_hash, created_at, role] = params;
      if (users.has(email)) return result(["email"]);
      users.set(email, { email, name, password_hash, created_at, role, login_count: 0, last_login_at: null });
      return result(["email"], [[email]]);
    }
    if (query.startsWith("SELECT * FROM cogniload_users")) {
      const row = users.get(params[0]);
      const names = ["email", "name", "password_hash", "created_at", "login_count", "last_login_at", "role"];
      return result(names, row ? [names.map((name) => row[name])] : [], [25, 25, 25, 25, 23, 25]);
    }
    const profileNames = ["email", "name", "role", "created_at", "login_count", "last_login_at", "profile", "profile_updated_at", "profile_updated_by"];
    const profileResult = (rows) => result(profileNames, rows.map((row) => profileNames.map((key) => key === "profile" ? JSON.stringify(row.profile || {}) : row[key] ?? null)), [25, 25, 25, 25, 23, 25, 3802, 25, 25]);
    if (query.startsWith("SELECT email, name, role")) return profileResult([...users.values()]);
    if (query.startsWith("UPDATE cogniload_users SET name")) {
      const [name, profile, updatedAt, editor, email, revision] = params;
      const row = users.get(email);
      if (!row || (row.profile_updated_at ?? null) !== revision) return profileResult([]);
      Object.assign(row, { name, profile: JSON.parse(profile), profile_updated_at: updatedAt, profile_updated_by: editor });
      return profileResult([row]);
    }
    if (query.startsWith("UPDATE cogniload_users")) {
      const row = users.get(params[1]);
      const names = ["email", "name", "password_hash", "created_at", "login_count", "last_login_at", "role"];
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
      const matching = query.includes("uploaded_by =")
        ? [...records.values()].filter((row) => params[0] === "true" || row.uploadedBy === params[1])
        : [...records.values()].filter((row) => row.participantId === params[0]);
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
    assert.equal((await findUser(email)).role, "user");
    await createUser({ ...user, email: "researcher@example.org", role: "researcher" });
    assert.equal((await findUser("researcher@example.org")).role, "researcher");
    const admin = { email: "admin@example.org", name: "Admin", passwordHash: "admin-hashed", createdAt: user.createdAt, role: "admin" };
    await createUser(admin);
    assert.equal((await findUser(admin.email)).role, "admin");
    assert.equal((await recordLogin(email)).loginCount, 1);
    assert.equal((await recordLogin(email)).role, "user");
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
    assert.equal((await listResearchRecords({ email, role: "researcher" })).length, 1);
    assert.equal((await listResearchRecords({ email, role: "user" })).length, 1);
    assert.equal((await listResearchRecords({ email: "other@example.org", role: "researcher" })).length, 1);
    assert.equal((await listResearchRecords({ email: "other@example.org", role: "user" })).length, 0);
    assert.equal((await listResearchRecords(admin)).length, 1);
    const scopedQuery = queries.find(({ query }) => query.includes("uploaded_by =") && query.startsWith("SELECT "));
    assert.ok(scopedQuery.params.includes(email));
    assert.equal(scopedQuery.query.includes(email), false);
    const key = clientKey(new Request("https://example.org/api/auth/login", { headers: { "x-vercel-forwarded-for": "192.0.2.3", "x-forwarded-for": "198.51.100.4" } }), "login");
    assert.equal(key, "login:192.0.2.3");
    assert.equal((await rateLimit(key, 2)).ok, true);
    assert.equal((await rateLimit(key, 2)).ok, true);
    assert.equal((await rateLimit(key, 2)).ok, false);
    assert.equal(queries.filter(({ query }) => query.startsWith("CREATE ")).length, 5);
    const roleUpgrade = queries.find(({ query }) => query.includes("DROP CONSTRAINT IF EXISTS cogniload_users_role_check"));
    assert.match(roleUpgrade.query, /role IN \('user', 'researcher', 'admin'\)/);
    assert.match(roleUpgrade.query, /ALTER COLUMN role SET DEFAULT 'user'/);
    const changes = normalizeUserProfile({ name: "Updated", profile: { participantId: "P001", age: 68, notes: "Follow-up" } });
    const saved = await updateManagedUser(email, changes, admin.email);
    assert.equal(saved.ok, true);
    assert.equal(saved.user.profile.notes, "Follow-up");
    assert.equal(saved.user.profileUpdatedBy, admin.email);
    assert.equal(saved.user.passwordHash, undefined);
    assert.deepEqual(await updateManagedUser(email, changes, admin.email), { ok: false, reason: "profile_conflict" });
    assert.deepEqual(await updateManagedUser("missing@example.org", changes, admin.email), { ok: false, reason: "not_found" });
    const listed = await listManagedUsers();
    assert.equal(listed.length, 3);
    assert.equal(listed.find((row) => row.email === email).name, "Updated");
    assert.equal((await findUser(email)).passwordHash, "hashed");
    assert.equal((await findUser(email)).role, "user");
    assert.equal(JSON.stringify(listed).includes("password"), false);
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
