import test from "node:test";
import assert from "node:assert/strict";
import { filterOverviewUsers, userOverview } from "../lib/dashboard/user-overview.mjs";

const accounts = [
  { email: "alice@example.test", name: "Alice", role: "user", profile: { participantId: "P001", age: 68, studyGroup: "patient", education: "none", mmseScores: [5, 5, 3, 0, 3, 6, 0, 1] } },
  { email: "bob@example.test", name: "Bob", role: "user", profile: { participantId: "P002", age: 40, studyGroup: "control", education: "primary", mmseScores: [4, 4, 3, 5, 3, 6, 2, 0] } },
  { email: "staff@example.test", role: "researcher", profile: {} },
  { email: "pending@example.test", role: "user", profile: { age: null, education: "above", mmseScores: [5, null, 3, 5, 3, 6, 2, 1] } },
];

test("user overview counts saved profiles and excludes missing ages or partial MMSE from averages", () => {
  const overview = userOverview(accounts);
  assert.equal(overview.count, 4);
  assert.equal(overview.participants, 2);
  assert.equal(overview.averageAge, 54);
  assert.equal(overview.agesKnown, 2);
  assert.equal(overview.agesMissing, 2);
  assert.deepEqual(overview.ageBands.map((band) => band.count), [0, 1, 1, 0]);
  assert.deepEqual(overview.groups, { patient: 1, control: 1, unassigned: 2 });
  assert.deepEqual(overview.education, { none: 1, primary: 1, above: 1, unassigned: 1 });
  assert.deepEqual(overview.assessed.map(({ total, max, percent }) => ({ total, max, percent })), [{ total: 23, max: 23, percent: 100 }, { total: 27, max: 30, percent: 90 }]);
  assert.equal(overview.assessmentsMissing, 2);
  assert.equal(accounts[0].profile.age, 68);
});

test("role, group and search filters compose and unknown roles remain ordinary users", () => {
  assert.equal(filterOverviewUsers(accounts, { role: "user" }).length, 3);
  assert.deepEqual(filterOverviewUsers(accounts, { role: "user", group: "patient", search: "ALICE P001" }).map((user) => user.email), ["alice@example.test"]);
  assert.equal(filterOverviewUsers(accounts, { group: "unassigned" }).length, 2);
  assert.equal(filterOverviewUsers(accounts, { role: "researcher", group: "control" }).length, 0);
  assert.equal(filterOverviewUsers([{ email: "legacy@example.test" }], { role: "user" }).length, 1);
});

test("empty or invalid profile data never creates fictional ages or completed assessments", () => {
  const empty = userOverview([]);
  assert.equal(empty.averageAge, null);
  assert.equal(empty.count, 0);
  assert.deepEqual(empty.assessed, []);
  const invalid = userOverview([{ email: "invalid@example.test", profile: { age: "68", education: "primary", mmseScores: [6, 5, 3, 5, 3, 6, 2, 1] } }]);
  assert.equal(invalid.averageAge, null);
  assert.equal(invalid.assessed.length, 0);
});

test("explicit mock profiles are excluded from demographic and MMSE statistics without deleting their values", () => {
  const mock = { ...accounts[0], profile: { ...accounts[0].profile, notes: "MOCK DATA — ข้อมูลสมมติสำหรับทดสอบระบบ" } };
  const summary = userOverview([mock]);
  assert.equal(summary.averageAge, null);
  assert.equal(summary.assessed.length, 0);
  assert.equal(summary.groups.unassigned, 1);
  assert.equal(summary.education.unassigned, 1);
  assert.equal(filterOverviewUsers([mock], { group: "patient" }).length, 0);
  assert.equal(mock.profile.mmseScores[0], 5);
});
