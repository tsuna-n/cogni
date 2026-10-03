import test from "node:test";
import assert from "node:assert/strict";
import { taskPerformance } from "../lib/research/task-performance.mjs";

function record(id, gameId = 1, trials = 10, correct = 8, extra = {}) {
  return { recordId: id, participantId: "P001", uploadedBy: "alice@test.example", summary: {
    status: "complete", testMode: false, gameId, condition: "standard",
    game: { gameId, trials, correct, errors: trials - correct, accuracyPercent: trials ? correct / trials * 100 : null },
    ...extra,
  } };
}

test("averages session percentages equally, separately by game, without producing MMSE", () => {
  const result = taskPerformance([record("a", 1, 10, 5), record("b", 2, 2, 2), record("c", 1, 100, 90)], "alice@test.example");
  assert.equal(result.accuracyPercent, 80);
  assert.equal(result.sessionCount, 3);
  assert.equal(result.trials, 112);
  assert.deepEqual(result.games.map(g => [g.sessionCount, g.accuracyPercent]), [[2, 70], [1, 100], [0, null]]);
  assert.equal(result.mmseScores, undefined);
});

test("excludes unfinished, device, simulation and unanswered sessions; deduplicates records", () => {
  const valid = record("valid");
  const inputs = [valid, valid, record("stopped", 1, 10, 8, { status: "stopped" }),
    record("test", 1, 10, 8, { testMode: true }), record("mock", 1, 10, 8, { condition: "MOCK DATA" }),
    record("simulated", 1, 10, 8, { simulated: true }), record("empty", 2, 0, 0)];
  assert.equal(taskPerformance(inputs, "alice@test.example").sessionCount, 1);
  assert.equal(taskPerformance(inputs.slice(2), "alice@test.example").accuracyPercent, null);
});

test("account ownership prevents borrowing another user's results through reused participant IDs", () => {
  const other = { ...record("other", 1, 10, 10), uploadedBy: "bob@test.example" };
  const source = [record("own", 1, 10, 0), other];
  assert.equal(taskPerformance(source, "alice@test.example").accuracyPercent, 0);
  assert.equal(taskPerformance(source, "bob@test.example").accuracyPercent, 100);
  assert.equal(taskPerformance(source, "unassessed@test.example").accuracyPercent, null);
});

test("invalid or incomplete historical game results never contribute fictional scores", () => {
  const inputs = [record("wrong-id", 1, 10, 8, { gameId: 2 }),
    record("invalid-count", 1, 10, 11), record("no-flag", 1, 10, 8, { testMode: undefined }),
    record("no-result", 1, 10, 8, { game: null }),
    record("wrong-accuracy", 1, 10, 8, { game: { gameId: 1, trials: 10, correct: 8, errors: 2, accuracyPercent: 90 } })];
  const before = structuredClone(inputs);
  assert.equal(taskPerformance(inputs, "alice@test.example").accuracyPercent, null);
  assert.deepEqual(inputs, before);
});
