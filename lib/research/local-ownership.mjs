export function isOwnedResearchSession(session, email) {
  const owner = String(email || "").trim().toLowerCase();
  return Boolean(owner) && (session?.ownerEmail || session?.serverSyncedBy) === owner;
}

export function isUnassignedResearchSession(session) {
  return Boolean(session) && !session.ownerEmail && !session.serverSyncedBy;
}
