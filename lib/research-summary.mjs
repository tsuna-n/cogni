export const RESEARCH_SUMMARY_VERSION = 1;

const total = (values) => Array.isArray(values) ? values.reduce((sum, value) => sum + (Number(value) || 0), 0) : 0;
const secondsBetween = (start, end) => Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 1000 : 0;

export function parseGameSummaryMarker(label) {
  const match = /^game_(\d+)_end_trials_(\d+)_correct_(\d+)_errors_(\d+)_mean_rt_(\d+)ms$/.exec(String(label || ""));
  if (!match) return null;
  const [, gameId, trials, correct, errors, meanRtMs] = match;
  return {
    gameId: Number(gameId),
    trials: Number(trials),
    correct: Number(correct),
    errors: Number(errors),
    accuracyPercent: Number(trials) ? 100 * Number(correct) / Number(trials) : null,
    meanRtMs: Number(trials) ? Number(meanRtMs) : null,
  };
}

export function findGameSummaryInChunks(chunks) {
  let result = null;
  for (const chunk of chunks || []) {
    for (const row of chunk.rows || []) {
      if (!row.startsWith('"event",')) continue;
      const match = row.match(/"(game_\d+_end_trials_\d+_correct_\d+_errors_\d+_mean_rt_\d+ms)"/);
      if (match) result = parseGameSummaryMarker(match[1]);
    }
  }
  return result;
}

export function summarizeResearchSession(session, gameSummary = session.gameSummary || null) {
  const startedMs = Number(session.startedMs);
  const endedMs = Number.isFinite(session.endedMs) ? session.endedMs : null;
  const effectiveEndMs = endedMs ?? (Number(session.lastPacketMs) || startedMs);
  const [baselineStart, taskStart, restStart] = session.phaseStarts || [];
  const durationSeconds = secondsBetween(startedMs, effectiveEndMs);
  const baselineSeconds = secondsBetween(baselineStart ?? startedMs, taskStart ?? effectiveEndMs);
  const taskSeconds = taskStart ? secondsBetween(taskStart, restStart ?? effectiveEndMs) : 0;
  const restSeconds = restStart ? secondsBetween(restStart, effectiveEndMs) : 0;
  const samples = Number(session.samples) || total(session.channels);
  const clippedSamples = total(session.railSamples);
  return {
    version: RESEARCH_SUMMARY_VERSION,
    startedMs,
    endedMs,
    status: session.status,
    testMode: Boolean(session.testMode),
    participant: session.participant || "",
    sessionId: session.sessionId || "",
    studyGroup: session.studyGroup || "",
    condition: session.condition || "",
    protocolVersion: session.protocolVersion || "",
    gameId: Number(session.gameId) || 0,
    durationSeconds,
    baselineSeconds,
    taskSeconds,
    restSeconds,
    samples,
    channelSamples: Array.from({ length: 4 }, (_, index) => Number(session.channels?.[index]) || 0),
    averageHzPerChannel: durationSeconds > 0 ? samples / 4 / durationSeconds : null,
    clippedSamples,
    clippedPercent: samples > 0 ? 100 * clippedSamples / samples : null,
    missingPackets: total(session.missingPackets),
    duplicatePackets: total(session.duplicatePackets),
    reorderedPackets: total(session.reorderedPackets),
    markers: Number(session.events) || 0,
    game: gameSummary,
  };
}
