import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeUserProfile, mmseTotal, UserProfileError } from "../lib/auth/user-profile.mjs";
import { createUser, listManagedUsers, updateManagedUser } from "../lib/auth/store.js";

test("profile validation supports unassessed domains and the original MMSE education rules", () => {
  const empty = normalizeUserProfile({ name: " Alice ", profile: {} });
  assert.equal(empty.name, "Alice");
  assert.equal(mmseTotal(empty.profile), null);
  const illiterate = normalizeUserProfile({ profile: { education: "none", mmseScores: [5, 5, 3, 0, 3, 6, 0, 1] } });
  assert.deepEqual(mmseTotal(illiterate.profile), { total: 23, max: 23 });
  const educated = normalizeUserProfile({ profile: { education: "above", mmseScores: [5, 5, 3, 5, 3, 6, 2, 1] } });
  assert.deepEqual(mmseTotal(educated.profile), { total: 30, max: 30 });
  const partial = normalizeUserProfile({ profile: { education: "primary", mmseScores: [5, null, 3, null, null, null, null, null] } });
  assert.equal(mmseTotal(partial.profile), null);
  for (const body of [
    null, [], { role: "admin", profile: {} }, { profile: { role: "admin" } },
    { profile: { age: "68" } }, { profile: { age: 9 } }, { profile: { age: 120.5 } },
    { name: "a".repeat(81), profile: {} }, { profile: { notes: "a".repeat(2001) } },
    { profile: { participantId: "bad\u0000value" } }, { profile: { education: "unknown" } },
    { profile: { education: "primary", mmseScores: [6, 5, 3, 5, 3, 6, 2, 1] } },
    { profile: { education: "none", mmseScores: [5, 5, 3, 5, 3, 6, 2, 1] } },
    { profile: { mmseScores: [5, 5, 3, 5, 3, 6, 2, 1] } },
  ]) assert.throws(() => normalizeUserProfile(body), UserProfileError);
});

test("local profile writes preserve account credentials, detect competing saves and persist metadata", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-profiles-"));
  const previous = process.env.COGNILOAD_DATA_DIR;
  process.env.COGNILOAD_DATA_DIR = directory;
  try {
    await createUser({ email: "user@example.test", passwordHash: "preserved-hash", role: "user", name: "User" });
    const changes = normalizeUserProfile({ name: "Updated", profile: { age: 68, notes: "Follow-up\nNext visit" } });
    const results = await Promise.all([updateManagedUser("user@example.test", changes, "admin@example.test"), updateManagedUser("user@example.test", changes, "researcher@example.test")]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.find((result) => !result.ok).reason, "profile_conflict");
    const stored = JSON.parse(await readFile(path.join(directory, "users.json"), "utf8"))["user@example.test"];
    assert.equal(stored.passwordHash, "preserved-hash");
    assert.equal(stored.role, "user");
    const listed = await listManagedUsers();
    assert.equal(listed[0].profile.notes, "Follow-up\nNext visit");
    assert.equal(listed[0].profileUpdatedBy, "admin@example.test");
    assert.equal(listed[0].passwordHash, undefined);
    const updated = await updateManagedUser(stored.email, { ...changes, expectedUpdatedAt: stored.profileUpdatedAt }, "researcher@example.test");
    assert.equal(updated.ok, true);
    assert.equal(updated.user.profileUpdatedBy, "researcher@example.test");
    assert.notEqual(updated.user.profileUpdatedAt, stored.profileUpdatedAt);
  } finally {
    if (previous === undefined) delete process.env.COGNILOAD_DATA_DIR;
    else process.env.COGNILOAD_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
