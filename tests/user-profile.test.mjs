import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeUserProfile, mmseTotal, profileAlphaBeta, UserProfileError } from "../lib/auth/user-profile.mjs";
import { createUser, listManagedUsers, updateManagedUser } from "../lib/auth/store.js";

test("reads saved account Alpha/Beta and preserves their provenance", () => {
  const source = "คำนวณจาก EEG ที่บันทึก ช่วง task (3 เกม)";
  assert.deepEqual(profileAlphaBeta({ notes: `Other notes\n[EEG Alpha/Beta]\nAlpha: 12.345678 µV²\nBeta: 0.000000 µV²\nแหล่งข้อมูล: ${source}\nรหัส EEG เดิม: P099\n[/EEG Alpha/Beta]` }), {
    alpha: 12.345678, beta: 0, source,
  });
  assert.deepEqual(profileAlphaBeta({ notes: "[EEG Alpha/Beta]\r\nAlpha: 2.5 µV²\r\nBeta: 1.25 µV²\r\nแหล่งข้อมูล: ข้อมูลสังเคราะห์ ไม่ใช่ค่าที่วัดจริง\r\n[/EEG Alpha/Beta]" }), {
    alpha: 2.5, beta: 1.25, source: "ข้อมูลสังเคราะห์ ไม่ใช่ค่าที่วัดจริง",
  });
});

test("missing or invalid profile Alpha/Beta stays absent rather than becoming zero", () => {
  for (const profile of [undefined, {}, { notes: "Alpha: 3 µV²\nBeta: 4 µV²" }, { notes: "[EEG Alpha/Beta]\nAlpha: -1 µV²\nBeta: NaN µV²\n[/EEG Alpha/Beta]" }]) {
    assert.deepEqual(profileAlphaBeta(profile), { alpha: null, beta: null, source: "" });
  }
});

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
