// Descriptive game performance only. This never supplies clinical MMSE scores.
export function taskPerformance(records, email) {
  const seen = new Set();
  const games = [1, 2, 3].map((gameId) => ({ gameId, sessionCount: 0, trials: 0, sum: 0 }));
  for (const record of records) {
    // Account ownership is authoritative; historical participant IDs can collide.
    if (record.uploadedBy !== email || !record.recordId || seen.has(record.recordId)) continue;
    seen.add(record.recordId);
    const summary = record.summary;
    const game = summary?.game;
    if (summary?.status !== "complete" || summary.testMode !== false ||
      summary.simulated === true || record.simulated === true ||
      /(?:mock|demo|simulat)/i.test(`${record.participantId || ""} ${summary.condition || ""}`) ||
      ![1, 2, 3].includes(summary.gameId) || game?.gameId !== summary.gameId ||
      !Number.isSafeInteger(game.trials) || game.trials <= 0 ||
      !Number.isSafeInteger(game.correct) || game.correct < 0 || game.correct > game.trials ||
      !Number.isSafeInteger(game.errors) || game.errors < 0 || game.correct + game.errors !== game.trials ||
      !Number.isFinite(game.accuracyPercent) || Math.abs(game.accuracyPercent - game.correct / game.trials * 100) > 0.01) continue;
    const bucket = games[summary.gameId - 1];
    bucket.sessionCount++;
    bucket.trials += game.trials;
    bucket.sum += game.correct / game.trials * 100;
  }
  const sessionCount = games.reduce((sum, game) => sum + game.sessionCount, 0);
  return {
    method: "mean-session-accuracy-v1",
    accuracyPercent: sessionCount ? games.reduce((sum, game) => sum + game.sum, 0) / sessionCount : null,
    sessionCount,
    trials: games.reduce((sum, game) => sum + game.trials, 0),
    games: games.map(({ sum, ...game }) => ({ ...game, accuracyPercent: game.sessionCount ? sum / game.sessionCount : null })),
  };
}
