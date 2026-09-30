import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getUserRole, isAdminUser, canReadResearchRecord } from "../lib/auth/roles.mjs";
import { createUser, findUser, recordLogin } from "../lib/auth/store.js";
import { listResearchRecords, saveResearchRecord } from "../lib/research/server-store.js";

test("missing or unrecognized roles default to ordinary users", () => {
  const researcher = { email: "alice@example.test" };
  const aliceRecord = { uploadedBy: researcher.email };
  const bobRecord = { uploadedBy: "bob@example.test" };
  assert.equal(getUserRole(researcher), "user");
  assert.equal(getUserRole({ role: "user" }), "user");
  assert.equal(getUserRole({ role: "unknown" }), "user");
  assert.equal(getUserRole({ role: "researcher" }), "researcher");
  assert.equal(getUserRole({ role: "admin" }), "admin");
  assert.equal(isAdminUser({ ...researcher, role: "ADMIN" }), false);
  assert.equal(isAdminUser({ role: "admin" }), false);
  assert.equal(canReadResearchRecord(null, aliceRecord), false);
  assert.equal(canReadResearchRecord(researcher, aliceRecord), true);
  assert.equal(canReadResearchRecord(researcher, bobRecord), false);
  assert.equal(canReadResearchRecord({ ...researcher, role: "researcher" }, bobRecord), true);
  assert.equal(canReadResearchRecord({ ...researcher, role: "admin" }, bobRecord), true);
});

test("local storage persists admin roles and isolates records with the same participant ID", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-access-"));
  const previous = process.env.COGNILOAD_DATA_DIR;
  process.env.COGNILOAD_DATA_DIR = directory;
  try {
    const alice = { email: "alice@example.test", role: "researcher" };
    const bob = { email: "bob@example.test", role: "researcher" };
    const admin = { email: "admin@example.test", role: "admin" };
    await createUser({ ...admin, name: "Admin", passwordHash: "test-hash" });
    assert.equal((await findUser(admin.email)).role, "admin");
    assert.equal((await recordLogin(admin.email)).role, "admin");
    await createUser({ ...alice, passwordHash: "test-hash" });
    assert.equal((await findUser(alice.email)).role, "researcher");
    await createUser({ email: "user@example.test", passwordHash: "test-hash" });
    assert.equal((await findUser("user@example.test")).role, "user");
    assert.equal((await recordLogin("user@example.test")).role, "user");
    for (const [index, user] of [alice, bob].entries()) {
      await saveResearchRecord({ recordId: `record-${index}`, participantId: "P001", summary: { startedMs: index } }, user.email);
    }
    assert.equal((await listResearchRecords(alice)).length, 2);
    assert.equal((await listResearchRecords(bob)).length, 2);
    assert.deepEqual((await listResearchRecords({ ...alice, role: "user" })).map((record) => record.recordId), ["record-0"]);
    assert.equal((await listResearchRecords(admin)).length, 2);
    assert.deepEqual(await listResearchRecords({ email: "unknown@example.test" }), []);
    await assert.rejects(listResearchRecords(null), /authenticated account/);
  } finally {
    if (previous === undefined) delete process.env.COGNILOAD_DATA_DIR;
    else process.env.COGNILOAD_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
