import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { summarizeResearchSession } from "../lib/research-summary.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("HTTP permissions use server roles and isolate researcher data", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-api-access-"));
  const secret = randomBytes(32).toString("hex");
  const password = "test-only-password";
  const passwordHash = await hashPassword(password);
  const users = Object.fromEntries([
    ["admin@example.test", "admin"],
    ["alice@example.test", "researcher"],
    ["bob@example.test", "researcher"],
    ["user@example.test", "user"],
  ].map(([email, role]) => [email, { email, name: role, role, passwordHash, createdAt: new Date().toISOString() }]));
  const startedMs = Date.now() - 65_000;
  const summary = summarizeResearchSession({
    participant: "P001", sessionId: "S01", studyGroup: "control",
    condition: "standard", protocolVersion: "pilot_1", gameId: 1,
    startedMs, endedMs: startedMs + 65_000,
    phaseStarts: [startedMs, startedMs + 30_000, startedMs + 35_000],
    status: "complete", samples: 1000, channels: [250, 250, 250, 250], events: 8,
  });
  const records = ["alice@example.test", "bob@example.test"].map((uploadedBy) => ({
    recordId: randomUUID(), participantId: "P001",
    uploadedBy, uploadedAt: new Date().toISOString(), summary,
  }));
  const usersFile = path.join(directory, "users.json");
  await writeFile(usersFile, JSON.stringify(users), { mode: 0o600 });
  await writeFile(path.join(directory, "research-summaries.json"), JSON.stringify({ version: 1, records }));
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const serverEnv = {
      ...process.env, NODE_ENV: "production", DATABASE_URL: "", VERCEL: "",
      COGNILOAD_DATA_DIR: directory, RESEARCH_DATA_DIR: directory,
      SESSION_SECRET: secret, ADMIN_USERS: "", RESEARCHER_USERS: "", DEMO_USERS: "",
      REGISTRATION_ENABLED: "true", NEXT_TELEMETRY_DISABLED: "1",
  };
  // Test the production handlers without taking the developer's next dev lock.
  const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    cwd: process.cwd(), env: serverEnv, encoding: "utf8", timeout: 60_000,
  });
  if (build.status !== 0) {
    await rm(directory, { recursive: true, force: true });
    throw new Error(`Test build failed: ${build.stdout}\n${build.stderr}`);
  }
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(), env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGTERM");
      const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
      await exited;
      clearTimeout(timer);
    }
    await rm(directory, { recursive: true, force: true });
  });
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
    try { if ((await fetch(`${base}/api/config`)).ok) { ready = true; break; } } catch {}
    await wait(100);
  }
  assert.ok(ready, `Test server did not start: ${logs}`);

  const request = async (endpoint, { cookie, method = "GET", body, headers = {} } = {}) => {
    const response = await fetch(`${base}${endpoint}`, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { response, data: await response.json() };
  };
  const login = async (email) => {
    const { response, data } = await request("/api/auth/login", { method: "POST", body: { email, password, role: "admin" } });
    assert.equal(response.status, 200);
    assert.equal(data.user.role, users[email].role);
    assert.equal(data.user.passwordHash, undefined);
    return response.headers.get("set-cookie").split(";")[0];
  };
  const adminCookie = await login("admin@example.test");
  const aliceCookie = await login("alice@example.test");
  const bobCookie = await login("bob@example.test");
  const userCookie = await login("user@example.test");

  await t.test("anonymous requests cannot read or write private data", async () => {
    for (const [endpoint, method] of [
      ["/api/research/summaries", "GET"], ["/api/research/summaries", "POST"],
      ["/api/admin/participants", "GET"], ["/api/admin/participants/P001", "GET"],
      ["/api/admin/settings", "GET"], ["/api/admin/settings", "PUT"], ["/api/admin/settings", "DELETE"],
      ["/api/dashboard/users", "GET"], ["/api/dashboard/users", "POST"], ["/api/dashboard/users/user%40example.test", "PUT"],
    ]) assert.equal((await request(endpoint, { method })).response.status, 401, `${method} ${endpoint}`);
  });
  await t.test("researchers cannot access admin APIs or impersonate a role", async () => {
    for (const [endpoint, method] of [
      ["/api/admin/participants?role=admin&email=admin@example.test", "GET"],
      ["/api/admin/participants/P001", "GET"],
      ["/api/admin/settings", "GET"], ["/api/admin/settings", "PUT"], ["/api/admin/settings", "DELETE"],
      ["/api/dashboard/users?role=admin", "POST"],
    ]) assert.equal((await request(endpoint, { cookie: aliceCookie, method, headers: { "x-user-role": "admin" } })).response.status, 403);
    const payload = Buffer.from(JSON.stringify({ email: "alice@example.test", role: "admin", exp: Date.now() + 60_000 })).toString("base64url");
    const signed = createHmac("sha256", secret).update(payload).digest("base64url");
    assert.equal((await request("/api/admin/participants", { cookie: `cogni_session=${payload}.${signed}` })).response.status, 403);
    assert.equal((await request("/api/admin/participants", { cookie: `cogni_session=${payload}.invalid-signature` })).response.status, 401);
    const expiredPayload = Buffer.from(JSON.stringify({ email: "admin@example.test", exp: Date.now() - 1000 })).toString("base64url");
    const expiredSignature = createHmac("sha256", secret).update(expiredPayload).digest("base64url");
    assert.equal((await request("/api/admin/participants", { cookie: `cogni_session=${expiredPayload}.${expiredSignature}` })).response.status, 401);
  });
  await t.test("researchers can review all synced summaries while users read only their own", async () => {
    for (const [cookie, email] of [[aliceCookie, "alice@example.test"], [bobCookie, "bob@example.test"]]) {
      const { response, data } = await request("/api/research/summaries?email=admin@example.test&uploadedBy=bob@example.test&role=admin", { cookie });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(data.records.length, 2);
      assert.deepEqual(new Set(data.records.map((record) => record.uploadedBy)), new Set(["alice@example.test", "bob@example.test"]));
    }
    const takeover = await request("/api/research/summaries", { cookie: aliceCookie, method: "POST", body: { recordId: records[1].recordId, summary } });
    assert.equal(takeover.response.status, 409);
    assert.equal(takeover.data.error, "record_conflict");
    const stored = JSON.parse(await readFile(path.join(directory, "research-summaries.json"), "utf8"));
    assert.equal(stored.records[1].uploadedBy, "bob@example.test");
    assert.deepEqual((await request("/api/research/summaries", { cookie: userCookie })).data.records, []);
  });
  await t.test("both staff roles can list and edit every user's profile without exposing credentials or changing roles", async () => {
    let revision = null;
    for (const [cookie, editor] of [[adminCookie, "admin@example.test"], [aliceCookie, "alice@example.test"]]) {
      const listed = await request("/api/dashboard/users", { cookie });
      assert.equal(listed.response.status, 200);
      assert.match(listed.response.headers.get("cache-control"), /no-store/);
      assert.equal(listed.data.users.length, 4);
      assert.equal(JSON.stringify(listed.data).includes("password"), false);
      const body = { name: "Participant name", expectedUpdatedAt: revision, profile: {
        participantId: "P001", age: 68, hand: "Right", sessionId: "S01", studyGroup: "control",
        education: "primary", mmseScores: [5, 5, 3, 5, 3, 6, 2, 1], notes: `Updated by ${editor}\nFollow-up`,
      } };
      const saved = await request("/api/dashboard/users/user%40example.test", { cookie, method: "PUT", body });
      assert.equal(saved.response.status, 200);
      assert.equal(saved.data.user.profile.age, 68);
      assert.equal(saved.data.user.profileUpdatedBy, editor);
      assert.equal(saved.data.user.role, "user");
      assert.equal(saved.data.user.passwordHash, undefined);
      const stale = await request("/api/dashboard/users/user%40example.test", { cookie, method: "PUT", body });
      assert.equal(stale.response.status, 409);
      assert.equal(stale.data.error, "profile_conflict");
      revision = saved.data.user.profileUpdatedAt;
      const freshList = await request("/api/dashboard/users", { cookie });
      assert.equal(freshList.data.users.find((user) => user.email === "user@example.test").profile.notes, body.profile.notes);
    }
    for (const cookie of [adminCookie, aliceCookie]) {
      const listed = (await request("/api/dashboard/users", { cookie })).data.users;
      for (const target of listed) {
        const result = await request(`/api/dashboard/users/${encodeURIComponent(target.email)}`, {
          cookie, method: "PUT", body: { name: target.name, profile: target.profile, expectedUpdatedAt: target.profileUpdatedAt },
        });
        assert.equal(result.response.status, 200, `Edit ${target.email}`);
        assert.equal(result.data.user.email, target.email);
        assert.equal(result.data.user.role, target.role);
      }
    }
    const stored = JSON.parse(await readFile(usersFile, "utf8"));
    assert.equal(stored["user@example.test"].passwordHash, passwordHash);
    assert.equal(stored["user@example.test"].role, "user");
    assert.equal(stored["user@example.test"].email, "user@example.test");
    for (const cookie of [adminCookie, aliceCookie]) {
      assert.equal((await request("/api/dashboard/users/missing%40example.test", { cookie, method: "PUT", body: { name: "Missing", profile: {} } })).response.status, 404);
      for (const extra of [{ role: "admin" }, { email: "replacement@example.test" }, { passwordHash: "changed" }]) {
        assert.equal((await request("/api/dashboard/users/user%40example.test", { cookie, method: "PUT", body: { name: "Invalid", profile: {}, ...extra } })).response.status, 400);
      }
      assert.equal((await request("/api/dashboard/users/user%40example.test", { cookie, method: "PUT", body: { name: "Invalid", profile: {} }, headers: { origin: "https://attacker.example" } })).response.status, 403);
      assert.equal((await request("/api/dashboard/users/user%40example.test", { cookie, method: "PUT", body: { name: "Invalid", profile: { age: 121 } } })).response.status, 400);
    }
  });
  await t.test("ordinary users cannot list or update other users through forged role parameters", async () => {
    const list = await request("/api/dashboard/users?role=admin", { cookie: userCookie, headers: { "x-user-role": "researcher" } });
    assert.equal(list.response.status, 403);
    assert.equal((await request("/api/dashboard/users", { cookie: userCookie, method: "POST", body: { role: "admin", adminEmail: "admin@example.test", adminPassword: password } })).response.status, 403);
    for (const email of ["alice@example.test", "user@example.test"]) {
      const saved = await request(`/api/dashboard/users/${encodeURIComponent(email)}`, { cookie: userCookie, method: "PUT", body: { name: "Forged", profile: {}, role: "admin" } });
      assert.equal(saved.response.status, 403);
    }
  });
  await t.test("admin can read all accounts' summaries and settings", async () => {
    assert.equal((await request("/api/research/summaries", { cookie: adminCookie })).data.records.length, 2);
    assert.equal((await request("/api/admin/participants", { cookie: adminCookie })).data.participants[0].sessionCount, 2);
    assert.equal((await request("/api/admin/participants/P001", { cookie: adminCookie })).data.records.length, 2);
    assert.equal((await request("/api/admin/settings", { cookie: adminCookie })).response.status, 200);
  });
  await t.test("admin creation requires their own credentials and persists the selected role without switching sessions", async () => {
    const newPassword = "new-account-password";
    const body = { email: "created-user@example.test", name: " New user ", password: newPassword, role: "user", adminEmail: "admin@example.test", adminPassword: password };
    const create = (changes = {}, headers = {}) => request("/api/dashboard/users", { cookie: adminCookie, method: "POST", body: { ...body, ...changes }, headers });
    for (const [changes, error] of [
      [{ email: "invalid" }, "invalid_email"], [{ name: "a".repeat(81) }, "invalid_name"],
      [{ password: "short" }, "weak_password"], [{ password: "a".repeat(201) }, "weak_password"],
      [{ role: "owner" }, "invalid_role"], [{ role: undefined }, "invalid_role"],
      [{ adminPassword: "" }, "missing_admin_credentials"], [{ adminEmail: 123 }, "missing_admin_credentials"],
      [{ passwordHash: "forged" }, "invalid_body"],
    ]) {
      const result = await create(changes);
      assert.equal(result.response.status, 400);
      assert.equal(result.data.error, error);
    }
    assert.equal((await create({}, { origin: "https://attacker.example" })).response.status, 403);
    assert.equal((await create({}, { origin: "invalid" })).response.status, 403);
    assert.equal((await create({ name: "a".repeat(17000) })).response.status, 413);
    assert.equal((await request("/api/dashboard/users", { cookie: adminCookie, method: "POST" })).response.status, 415);
    for (const raw of ["{", "null", "[]"]) {
      const malformed = await fetch(`${base}/api/dashboard/users`, { method: "POST", headers: { cookie: adminCookie, "Content-Type": "application/json" }, body: raw });
      assert.equal(malformed.status, 400);
    }
    for (const changes of [{ adminPassword: "incorrect" }, { adminEmail: "alice@example.test" }]) {
      const result = await create(changes);
      assert.equal(result.response.status, 403);
      assert.equal(result.data.error, "invalid_admin_credentials");
      assert.equal(JSON.parse(await readFile(usersFile, "utf8"))[body.email], undefined);
    }
    for (const role of ["user", "researcher", "admin"]) {
      const email = `created-${role}@example.test`;
      const result = await create({ email: ` ${email.toUpperCase()} `, role, adminEmail: " ADMIN@EXAMPLE.TEST " }, { origin: base });
      assert.equal(result.response.status, 201);
      assert.equal(result.response.headers.get("set-cookie"), null);
      assert.match(result.response.headers.get("cache-control"), /no-store/);
      assert.equal(result.data.user.email, email);
      assert.equal(result.data.user.name, "New user");
      assert.equal(result.data.user.role, role);
      assert.equal(result.data.user.loginCount, 0);
      assert.deepEqual(result.data.user.profile, {});
      assert.equal(JSON.stringify(result.data).includes("password"), false);
      const stored = JSON.parse(await readFile(usersFile, "utf8"))[email];
      assert.equal(stored.role, role);
      assert.notEqual(stored.passwordHash, newPassword);
      assert.ok(await verifyPassword(newPassword, stored.passwordHash));
      assert.equal(stored.adminPassword, undefined);
      assert.equal(stored.adminEmail, undefined);
      const signedIn = await request("/api/auth/login", { method: "POST", body: { email, password: newPassword } });
      assert.equal(signedIn.response.status, 200);
      assert.equal(signedIn.data.user.role, role);
      const cookie = signedIn.response.headers.get("set-cookie").split(";")[0];
      assert.equal((await request("/api/admin/settings", { cookie })).response.status, role === "admin" ? 200 : 403);
      assert.equal((await request("/api/dashboard/users", { cookie })).response.status, role === "user" ? 403 : 200);
      if (role === "admin") {
        // A second administrator's correct credentials cannot confirm the original admin's action.
        const different = await create({ email: "wrong-admin@example.test", adminEmail: email, adminPassword: newPassword });
        assert.equal(different.response.status, 403);
        assert.equal(different.data.error, "invalid_admin_credentials");
        for (let attempt = 0; attempt < 10; attempt++) {
          const failed = await request("/api/dashboard/users", { cookie, method: "POST", body: { ...body, email: "rate-test@example.test", adminEmail: email, adminPassword: "incorrect" } });
          assert.equal(failed.response.status, 403);
        }
        const limited = await request("/api/dashboard/users", { cookie, method: "POST", body: { ...body, adminEmail: email, adminPassword: newPassword } });
        assert.equal(limited.response.status, 429);
        assert.ok(Number(limited.response.headers.get("retry-after")) > 0);
      }
    }
    const duplicate = await create();
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.data.error, "email_taken");
    const competing = await Promise.all([create({ email: "race@example.test" }), create({ email: "race@example.test" })]);
    assert.deepEqual(competing.map((result) => result.response.status).sort(), [201, 409]);
    const unchanged = await request("/api/auth/me", { cookie: adminCookie });
    assert.equal(unchanged.data.user.email, "admin@example.test");
    assert.equal(unchanged.data.user.role, "admin");
    const listed = (await request("/api/dashboard/users", { cookie: adminCookie })).data.users;
    assert.equal(listed.find((user) => user.email === "created-researcher@example.test").role, "researcher");
  });
  await t.test("signup always stores ordinary users despite requested privileged roles", async () => {
    for (const role of ["admin", "researcher"]) {
      const email = `signup-${role}@example.test`;
      const result = await request("/api/auth/register", { method: "POST", body: { email, password, name: "Signup", role, isAdmin: true } });
      assert.equal(result.response.status, 201);
      assert.equal(result.data.user.role, "user");
      const cookie = result.response.headers.get("set-cookie").split(";")[0];
      assert.equal((await request("/api/auth/me", { cookie })).data.user.role, "user");
      assert.equal((await request("/api/admin/participants", { cookie })).response.status, 403);
      assert.deepEqual((await request("/api/research/summaries", { cookie })).data.records, []);
      const stored = JSON.parse(await readFile(usersFile, "utf8"));
      assert.equal(stored[email].role, "user");
      const relogin = await request("/api/auth/login", { method: "POST", body: { email, password, role: "admin" } });
      assert.equal(relogin.response.status, 200);
      assert.equal(relogin.data.user.role, "user");
    }
  });
  await t.test("database role assignments take effect on existing ordinary user sessions", async () => {
    const email = "signup-admin@example.test";
    const signedIn = await request("/api/auth/login", { method: "POST", body: { email, password } });
    assert.equal(signedIn.response.status, 200);
    const cookie = signedIn.response.headers.get("set-cookie").split(";")[0];
    for (const role of ["researcher", "admin", "user"]) {
      const stored = JSON.parse(await readFile(usersFile, "utf8"));
      stored[email].role = role;
      await writeFile(usersFile, JSON.stringify(stored));
      assert.equal((await request("/api/auth/me", { cookie })).data.user.role, role);
      assert.equal((await request("/api/admin/participants", { cookie })).response.status, role === "admin" ? 200 : 403);
      assert.equal((await request("/api/dashboard/users", { cookie })).response.status, role === "user" ? 403 : 200);
    }
  });
  await t.test("revoking a role or deleting an account invalidates permissions on existing sessions", async () => {
    const stored = JSON.parse(await readFile(usersFile, "utf8"));
    stored["admin@example.test"].role = "researcher";
    delete stored["bob@example.test"];
    stored["alice@example.test"].role = "user";
    await writeFile(usersFile, JSON.stringify(stored));
    assert.equal((await request("/api/admin/participants", { cookie: adminCookie })).response.status, 403);
    assert.equal((await request("/api/auth/me", { cookie: adminCookie })).data.user.role, "researcher");
    assert.equal((await request("/api/research/summaries", { cookie: bobCookie })).response.status, 401);
    assert.equal((await request("/api/dashboard/users", { cookie: aliceCookie })).response.status, 403);
    assert.equal((await request("/api/dashboard/users/user%40example.test", { cookie: aliceCookie, method: "PUT", body: { name: "Forbidden", profile: {} } })).response.status, 403);
    assert.equal((await request("/api/research/summaries", { cookie: aliceCookie })).data.records.length, 1);
  });
});
