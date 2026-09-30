import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUser, findUser, recordLogin } from "../lib/auth/store.js";

test("privileged accounts come only from storage and environment accounts cannot override them", async () => {
  const variables = ["ADMIN_USERS", "RESEARCHER_USERS", "DEMO_USERS", "COGNILOAD_DATA_DIR"];
  const before = Object.fromEntries(variables.map((name) => [name, process.env[name]]));
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-researcher-test-"));
  process.env.ADMIN_USERS = "user@example.org:a-long-admin-password";
  process.env.RESEARCHER_USERS = "operator@example.org:a-long-study-password,weak@example.org:short";
  process.env.DEMO_USERS = "demo@example.org:a-long-demo-password";
  process.env.COGNILOAD_DATA_DIR = directory;
  try {
    for (const email of ["user@example.org", "operator@example.org", "weak@example.org", "demo@example.org"]) {
      assert.equal(await findUser(email), null);
      assert.equal(await recordLogin(email), null);
    }
    await createUser({ email: "user@example.org", role: "user", passwordHash: "stored-user-hash" });
    const user = await findUser("user@example.org");
    assert.equal(user.role, "user");
    assert.equal(user.passwordHash, "stored-user-hash");
    assert.equal((await recordLogin(user.email)).role, "user");
    await createUser({ email: "operator@example.org", role: "researcher", passwordHash: "stored-researcher-hash" });
    assert.equal((await findUser("operator@example.org")).passwordHash, "stored-researcher-hash");
    assert.equal((await findUser("operator@example.org")).role, "researcher");
  } finally {
    for (const name of variables) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
    await rm(directory, { recursive: true, force: true });
  }
});
