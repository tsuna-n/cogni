import test from "node:test";
import assert from "node:assert/strict";
import { researchOverview } from "../lib/dashboard/research-overview.mjs";

test("dashboard separates device checks from participant counts and study completion", () => {
  const records = [
    { recordId: "first", participantId: "P001", summary: { startedMs: 10, studyGroup: "control", status: "complete" } },
    { recordId: "second", participantId: "P001", summary: { startedMs: 20, studyGroup: "control", status: "disconnect" } },
    { recordId: "third", participantId: "P002", summary: { startedMs: 30, studyGroup: "patient", status: "complete" } },
    { recordId: "unknown", participantId: "P003", summary: { startedMs: 40, studyGroup: "legacy", status: "hidden" } },
    { recordId: "check", participantId: "TEST", summary: { startedMs: 50, studyGroup: "device_test", status: "complete" } },
    { recordId: "flagged", participantId: "TEST2", summary: { startedMs: 60, testMode: true, status: "complete" } },
  ];
  const overview = researchOverview(records);
  assert.equal(overview.total, 6);
  assert.equal(overview.studyCount, 4);
  assert.equal(overview.deviceTests, 2);
  assert.equal(overview.participants, 3);
  assert.equal(overview.complete, 2);
  assert.equal(overview.interrupted, 2);
  assert.deepEqual(overview.groups, { patient: 1, control: 2, unassigned: 1 });
  assert.deepEqual(overview.recent.map((record) => record.recordId), ["flagged", "check", "unknown", "third", "second"]);
  assert.equal(records[0].recordId, "first");
});

test("an empty dashboard shows zero real recordings", () => {
  assert.deepEqual(researchOverview([]), { total: 0, studyCount: 0, deviceTests: 0, participants: 0, complete: 0, interrupted: 0, groups: { patient: 0, control: 0, unassigned: 0 }, recent: [] });
});
