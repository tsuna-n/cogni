import test from "node:test";
import assert from "node:assert/strict";
import { findGameSummaryInChunks, parseGameSummaryMarker, summarizeResearchSession } from "../lib/research-summary.mjs";

test("a completed session keeps actual phase times, EEG quality, and game results", () => {
  const game = parseGameSummaryMarker("game_2_end_trials_6_correct_5_errors_1_mean_rt_680ms");
  const summary = summarizeResearchSession({
    startedMs: 1000,
    endedMs: 68000,
    phaseStarts: [1000, 31000, 38000],
    status: "complete",
    participant: "P001",
    sessionId: "S01",
    gameId: 2,
    samples: 64000,
    channels: [16000, 16000, 16000, 16000],
    railSamples: [1, 2, 0, 0],
    missingPackets: [0, 2, 0, 1],
    duplicatePackets: [1, 0, 0, 0],
    reorderedPackets: [0, 0, 1, 0],
    events: 25,
  }, game);
  assert.equal(summary.durationSeconds, 67);
  assert.deepEqual([summary.baselineSeconds, summary.taskSeconds, summary.restSeconds], [30, 7, 30]);
  assert.equal(summary.averageHzPerChannel, 64000 / 4 / 67);
  assert.equal(summary.clippedSamples, 3);
  assert.equal(summary.missingPackets, 3);
  assert.ok(Math.abs(summary.game.accuracyPercent - 5 / 6 * 100) < 1e-9);
  assert.equal(summary.game.meanRtMs, 680);
});

test("an interrupted session is still summarized without inventing task or rest data", () => {
  const summary = summarizeResearchSession({ startedMs: 1000, endedMs: 11000, phaseStarts: [1000], status: "interrupted", samples: 0 });
  assert.equal(summary.durationSeconds, 10);
  assert.deepEqual([summary.baselineSeconds, summary.taskSeconds, summary.restSeconds], [10, 0, 0]);
  assert.equal(summary.averageHzPerChannel, 0);
  assert.equal(summary.clippedPercent, null);
  assert.equal(summary.game, null);
});

test("game results can be recovered from an older session's event rows", () => {
  const game = findGameSummaryInChunks([
    { rows: ['"eeg","1"', '"event","1","2","task","","","","","","game_1_end_trials_4_correct_3_errors_1_mean_rt_510ms","1"'] },
  ]);
  assert.deepEqual(game, { gameId: 1, trials: 4, correct: 3, errors: 1, accuracyPercent: 75, meanRtMs: 510 });
});
