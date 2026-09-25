import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { summarizeResearchSession } from "../lib/research-summary.mjs";
import { normalizeResearchSubmission, ResearchValidationError } from "../lib/research/validation.js";
import { listParticipantRecords, listParticipants, saveResearchRecord } from "../lib/research/server-store.js";

function submission(participant = "P001", sessionId = "S01") {
  const startedMs = Date.now() - 70_000;
  const summary = summarizeResearchSession({
    startedMs,
    endedMs: startedMs + 65_000,
    phaseStarts: [startedMs, startedMs + 30_000, startedMs + 35_000],
    status: "complete",
    participant,
    sessionId,
    studyGroup: "control",
    condition: "standard",
    gameId: 1,
    samples: 1000,
    channels: [250, 250, 250, 250],
    railSamples: [0, 0, 0, 0],
    missingPackets: [0, 1, 0, 0],
    duplicatePackets: [0, 0, 0, 0],
    reorderedPackets: [0, 0, 0, 0],
    events: 8,
  });
  return normalizeResearchSubmission({ recordId: randomUUID(), summary });
}

test("validates finalized summaries and rejects inconsistent counts", () => {
  const valid = submission();
  assert.equal(valid.participantId, "P001");
  assert.equal(valid.summary.samples, 1000);
  assert.throws(() => normalizeResearchSubmission({ ...valid, summary: { ...valid.summary, samples: 1001 } }), ResearchValidationError);
  assert.throws(() => normalizeResearchSubmission({ ...valid, summary: { ...valid.summary, status: "recording" } }), ResearchValidationError);
});

test("stores per-ID summaries and prevents record takeover", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cogni-admin-test-"));
  process.env.RESEARCH_DATA_DIR = directory;
  try {
    const first = submission("P001", "S01");
    const second = submission("P001", "S02");
    const other = submission("P002", "S01");
    assert.equal((await saveResearchRecord(first, "researcher@example.org")).ok, true);
    await saveResearchRecord(second, "researcher@example.org");
    await saveResearchRecord(other, "other@example.org");
    assert.deepEqual(await listParticipants("p00"), [{ id: "P001", sessionCount: 2 }, { id: "P002", sessionCount: 1 }]);
    assert.equal((await listParticipantRecords("P001")).length, 2);
    assert.equal((await listParticipantRecords("P002"))[0].uploadedBy, "other@example.org");
    assert.deepEqual(await saveResearchRecord(first, "other@example.org"), { ok: false, reason: "record_conflict" });
    assert.deepEqual(await saveResearchRecord({ ...first, participantId: "P002" }, "researcher@example.org"), { ok: false, reason: "record_conflict" });
    assert.equal(JSON.parse(await readFile(path.join(directory, "research-summaries.json"), "utf8")).records.length, 3);
  } finally {
    delete process.env.RESEARCH_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});
