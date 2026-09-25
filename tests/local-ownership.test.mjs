import test from "node:test";
import assert from "node:assert/strict";
import { isOwnedResearchSession, isUnassignedResearchSession } from "../lib/research/local-ownership.mjs";

test("local recordings belong to one researcher and unassigned recordings require recovery", () => {
  const alice = { ownerEmail: "alice@example.org" };
  const oldSynced = { serverSyncedBy: "alice@example.org" };
  const unassigned = {};
  assert.equal(isOwnedResearchSession(alice, "alice@example.org"), true);
  assert.equal(isOwnedResearchSession(alice, "bob@example.org"), false);
  assert.equal(isOwnedResearchSession(oldSynced, "alice@example.org"), true);
  assert.equal(isOwnedResearchSession(oldSynced, "bob@example.org"), false);
  assert.equal(isUnassignedResearchSession(oldSynced), false);
  assert.equal(isOwnedResearchSession(unassigned, "alice@example.org"), false);
  assert.equal(isUnassignedResearchSession(unassigned), true);
  assert.equal(isOwnedResearchSession(unassigned, ""), false);
});
