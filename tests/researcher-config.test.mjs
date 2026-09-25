import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { findUser } from "../lib/auth/store.js";
import { verifyPassword } from "../lib/auth/password.js";

test("preconfigured researcher can sign in while weak entries are ignored", async () => {
  const before = process.env.RESEARCHER_USERS;
  const beforeDir = process.env.COGNILOAD_DATA_DIR;
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-researcher-test-"));
  process.env.RESEARCHER_USERS = "operator@example.org:a-long-study-password,weak@example.org:short";
  process.env.COGNILOAD_DATA_DIR = directory;
  try {
    const operator = await findUser("operator@example.org");
    assert.equal(operator.role, "researcher");
    assert.equal(await verifyPassword("a-long-study-password", operator.passwordHash), true);
    assert.equal(await findUser("weak@example.org"), null);
  } finally {
    if (before === undefined) delete process.env.RESEARCHER_USERS;
    else process.env.RESEARCHER_USERS = before;
    if (beforeDir === undefined) delete process.env.COGNILOAD_DATA_DIR;
    else process.env.COGNILOAD_DATA_DIR = beforeDir;
    await rm(directory, { recursive: true, force: true });
  }
});
