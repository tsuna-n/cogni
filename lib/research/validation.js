const RECORD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINAL_STATUSES = new Set(["complete", "stopped", "disconnect", "signal_lost", "hidden", "task_screen_left", "task_not_started", "interrupted"]);

export class ResearchValidationError extends Error {}

function fail(message) {
  throw new ResearchValidationError(message);
}

function text(value, field, maxLength, required = false) {
  if (typeof value !== "string") fail(`${field} must be text`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) fail(`${field} is invalid`);
  return normalized;
}

function numeric(value, field, max, { nullable = false, integer = false } = {}) {
  if (nullable && value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) fail(`${field} is invalid`);
  return value;
}

export function normalizeResearchSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Invalid submission");
  const recordId = String(body.recordId || "");
  if (!RECORD_ID_RE.test(recordId)) fail("Invalid record ID");
  const source = body.summary;
  if (!source || typeof source !== "object" || Array.isArray(source) || source.version !== 1) fail("Invalid summary version");

  const startedMs = numeric(source.startedMs, "start time", Number.MAX_SAFE_INTEGER, { integer: true });
  const endedMs = numeric(source.endedMs, "end time", Number.MAX_SAFE_INTEGER, { integer: true });
  if (startedMs < Date.UTC(2020, 0, 1) || startedMs > Date.now() + 86_400_000 || endedMs < startedMs || endedMs - startedMs > 3_600_000) fail("Invalid session time");
  if (!FINAL_STATUSES.has(source.status)) fail("Invalid session status");
  if (typeof source.testMode !== "boolean") fail("Invalid test mode");

  const participant = text(source.participant, "participant ID", 40, true);
  const sessionId = text(source.sessionId, "session ID", 40, true);
  const studyGroup = text(source.studyGroup, "study group", 40);
  const condition = text(source.condition, "condition", 80);
  const gameId = numeric(source.gameId, "game ID", 3, { integer: true });
  if (!Array.isArray(source.channelSamples) || source.channelSamples.length !== 4) fail("Invalid channel counts");
  const channelSamples = source.channelSamples.map((count, index) => numeric(count, `channel ${index}`, 20_000_000, { integer: true }));
  const samples = numeric(source.samples, "EEG samples", 80_000_000, { integer: true });
  if (channelSamples.reduce((sum, count) => sum + count, 0) !== samples) fail("EEG sample counts disagree");
  const clippedSamples = numeric(source.clippedSamples, "clipped samples", samples, { integer: true });
  const clippedPercent = numeric(source.clippedPercent, "clipped percent", 100, { nullable: true });
  if (samples > 0 && clippedPercent === null || samples === 0 && clippedPercent !== null) fail("Invalid clipped percent");
  if (samples > 0 && Math.abs(clippedPercent - 100 * clippedSamples / samples) > 0.01) fail("Clipped percentage disagrees");

  const durationSeconds = numeric(source.durationSeconds, "duration", 3600);
  const baselineSeconds = numeric(source.baselineSeconds, "baseline duration", 3600);
  const taskSeconds = numeric(source.taskSeconds, "task duration", 3600);
  const restSeconds = numeric(source.restSeconds, "rest duration", 3600);
  if (Math.abs(durationSeconds - (endedMs - startedMs) / 1000) > 0.1 || Math.abs(durationSeconds - baselineSeconds - taskSeconds - restSeconds) > 0.1) fail("Phase durations disagree");
  const averageHzPerChannel = numeric(source.averageHzPerChannel, "sample rate", 10_000, { nullable: true });
  if (durationSeconds > 0 && samples > 0 && (averageHzPerChannel === null || Math.abs(averageHzPerChannel - samples / 4 / durationSeconds) > 0.1)) fail("Sample rate disagrees");

  let game = null;
  if (source.game != null) {
    if (!source.game || typeof source.game !== "object" || Array.isArray(source.game)) fail("Invalid game summary");
    const trials = numeric(source.game.trials, "game trials", 100_000, { integer: true });
    const correct = numeric(source.game.correct, "correct responses", trials, { integer: true });
    const errors = numeric(source.game.errors, "game errors", trials, { integer: true });
    const accuracyPercent = numeric(source.game.accuracyPercent, "game accuracy", 100, { nullable: true });
    const meanRtMs = numeric(source.game.meanRtMs, "reaction time", 600_000, { nullable: true });
    if (correct + errors !== trials || (trials > 0 && (accuracyPercent === null || Math.abs(accuracyPercent - correct / trials * 100) > 0.01)) || (trials === 0 && accuracyPercent !== null)) fail("Game results disagree");
    game = { gameId: numeric(source.game.gameId, "game ID", 3, { integer: true }), trials, correct, errors, accuracyPercent, meanRtMs };
    if (game.gameId !== gameId) fail("Game ID disagrees");
  }

  return {
    recordId,
    participantId: participant,
    summary: {
      version: 1,
      startedMs,
      endedMs,
      status: source.status,
      testMode: source.testMode,
      participant,
      sessionId,
      studyGroup,
      condition,
      gameId,
      durationSeconds,
      baselineSeconds,
      taskSeconds,
      restSeconds,
      samples,
      channelSamples,
      averageHzPerChannel,
      clippedSamples,
      clippedPercent,
      missingPackets: numeric(source.missingPackets, "missing packets", 80_000_000, { integer: true }),
      duplicatePackets: numeric(source.duplicatePackets, "duplicate packets", 80_000_000, { integer: true }),
      reorderedPackets: numeric(source.reorderedPackets, "out-of-order packets", 80_000_000, { integer: true }),
      markers: numeric(source.markers, "event markers", 1_000_000, { integer: true }),
      game,
    },
  };
}
