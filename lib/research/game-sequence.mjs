import { isOwnedResearchSession } from "./local-ownership.mjs";

export const RESEARCH_GAMES = [
  { id: 1, name: "Odd or Even / คี่หรือคู่" },
  { id: 2, name: "Echo Sequence / ลำดับสะท้อน" },
  { id: 3, name: "Pattern Drift / รูปแบบเปลี่ยนแปลง" },
];

export function sequenceFromSession(session) {
  if (
    !session?.sequenceId ||
    !session.sequenceBaseSessionId ||
    session.testMode
  )
    return null;
  return {
    id: session.sequenceId,
    baseSessionId: session.sequenceBaseSessionId,
  };
}

export function sequenceGameSessionId(baseSessionId, gameId) {
  if (
    !baseSessionId.trim() ||
    baseSessionId.trim().length > 37 ||
    !RESEARCH_GAMES.some((game) => game.id === gameId)
  )
    throw new Error("Invalid game sequence session ID");
  return `${baseSessionId.trim()}-G${gameId}`;
}

export function recordedSequenceGames(sequenceId, sessions, ownerEmail) {
  if (!sequenceId) return new Set();
  return new Set(
    sessions
      .filter(
        (session) =>
          session.sequenceId === sequenceId &&
          !session.testMode &&
          session.status === "complete" &&
          isOwnedResearchSession(session, ownerEmail),
      )
      .map((session) => session.gameId),
  );
}

export function sequenceAction(session, sessions, ownerEmail) {
  if (
    !sequenceFromSession(session) ||
    !RESEARCH_GAMES.some((game) => game.id === session.gameId) ||
    !isOwnedResearchSession(session, ownerEmail)
  )
    return null;
  const stored = sessions.find(
    (record) =>
      record.id === session.id &&
      record.sequenceId === session.sequenceId &&
      record.gameId === session.gameId &&
      isOwnedResearchSession(record, ownerEmail),
  );
  if (
    !stored ||
    stored.status !== session.status ||
    ["recording", "storage_error"].includes(stored.status)
  )
    return null;
  const complete = recordedSequenceGames(
    session.sequenceId,
    sessions,
    ownerEmail,
  );
  if (
    RESEARCH_GAMES.some(
      (game) => game.id < session.gameId && !complete.has(game.id),
    )
  )
    return null;
  if (stored.status !== "complete")
    return { type: "retry", gameId: session.gameId };
  return session.gameId === RESEARCH_GAMES.length
    ? { type: "finished" }
    : { type: "next", gameId: session.gameId + 1 };
}
