const DATABASE = "cogniload-muse-research";
const VERSION = 1;
let databasePromise;

export function openResearchDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB ไม่พร้อมใช้งานในเบราว์เซอร์นี้"));
        return;
      }
      const request = indexedDB.open(DATABASE, VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("sessions")) database.createObjectStore("sessions", { keyPath: "id" });
        if (!database.objectStoreNames.contains("chunks")) {
          const chunks = database.createObjectStore("chunks", { keyPath: ["sessionId", "sequence"] });
          chunks.createIndex("sessionId", "sessionId");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("เปิดฐานข้อมูลไม่ได้"));
      request.onblocked = () => reject(new Error("ฐานข้อมูลถูกแท็บอื่นใช้งานอยู่ กรุณาปิดแท็บนั้น"));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("บันทึกข้อมูลไม่สำเร็จ"));
    transaction.onabort = () => reject(transaction.error || new Error("การบันทึกข้อมูลถูกยกเลิก"));
  });
}

export async function saveResearchSession(session, sequence, rows) {
  const database = await openResearchDatabase();
  const transaction = database.transaction(["sessions", "chunks"], "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("sessions");
  const request = store.get(session.id);
  request.onsuccess = () => {
    const previous = request.result;
    const sameSummary = previous?.serverSyncedAt && session.summary && JSON.stringify(previous.summary) === JSON.stringify(session.summary);
    store.put(sameSummary ? { ...session, serverSyncedAt: previous.serverSyncedAt, serverSyncedBy: previous.serverSyncedBy } : session);
  };
  if (rows?.length) transaction.objectStore("chunks").put({ sessionId: session.id, sequence, rows });
  await done;
}

export async function listResearchSessions() {
  const database = await openResearchDatabase();
  const transaction = database.transaction("sessions", "readonly");
  const request = transaction.objectStore("sessions").getAll();
  const done = transactionDone(transaction);
  await done;
  return request.result.sort((a, b) => b.startedMs - a.startedMs);
}

export async function claimUnassignedResearchSession(sessionId, ownerEmail) {
  const owner = String(ownerEmail || "").trim().toLowerCase();
  if (!owner) throw new Error("An account is required to assign a session");
  const database = await openResearchDatabase();
  const transaction = database.transaction("sessions", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("sessions");
  const request = store.get(sessionId);
  let result = { ok: false, reason: "not_found" };
  request.onsuccess = () => {
    const current = request.result;
    if (!current) return;
    if (current.ownerEmail || current.serverSyncedBy) {
      result = { ok: false, reason: "already_assigned" };
      return;
    }
    if (current.status === "recording" && Date.now() - (current.lastPacketMs || current.startedMs || 0) < 60_000) {
      result = { ok: false, reason: "possibly_active" };
      return;
    }
    const interrupted = current.status === "recording";
    store.put({
      ...current,
      ownerEmail: owner,
      ...(interrupted ? { status: "interrupted", endedMs: current.lastPacketMs || current.startedMs, summary: null } : {}),
      serverSyncedAt: null,
      serverSyncedBy: null,
    });
    result = { ok: true };
  };
  await done;
  return result;
}

export async function getResearchChunks(sessionId) {
  const database = await openResearchDatabase();
  const transaction = database.transaction("chunks", "readonly");
  const request = transaction.objectStore("chunks").index("sessionId").getAll(IDBKeyRange.only(sessionId));
  const done = transactionDone(transaction);
  await done;
  return request.result.sort((a, b) => a.sequence - b.sequence);
}

export async function getResearchGameSummaryMarker(sessionId) {
  const database = await openResearchDatabase();
  const transaction = database.transaction("chunks", "readonly");
  const done = transactionDone(transaction);
  const request = transaction.objectStore("chunks").index("sessionId").openCursor(IDBKeyRange.only(sessionId));
  let marker = null;
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    for (const row of cursor.value.rows || []) {
      if (!row.startsWith('"event",')) continue;
      const match = row.match(/"(game_\d+_end_trials_\d+_correct_\d+_errors_\d+_mean_rt_\d+ms)"/);
      if (match) marker = match[1];
    }
    cursor.continue();
  };
  await done;
  return marker;
}

export async function deleteResearchSession(sessionId) {
  const database = await openResearchDatabase();
  const transaction = database.transaction(["sessions", "chunks"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("sessions").delete(sessionId);
  const request = transaction.objectStore("chunks").index("sessionId").openKeyCursor(IDBKeyRange.only(sessionId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      transaction.objectStore("chunks").delete(cursor.primaryKey);
      cursor.continue();
    }
  };
  await done;
}

export async function pruneResearchRawData(session) {
  const database = await openResearchDatabase();
  const transaction = database.transaction(["sessions", "chunks"], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore("sessions").put({ ...session, rawDeleted: true });
  const request = transaction.objectStore("chunks").index("sessionId").openKeyCursor(IDBKeyRange.only(session.id));
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      transaction.objectStore("chunks").delete(cursor.primaryKey);
      cursor.continue();
    }
  };
  await done;
}

export async function saveResearchSummary(sessionId, summary, gameSummary) {
  const database = await openResearchDatabase();
  const transaction = database.transaction("sessions", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("sessions");
  const request = store.get(sessionId);
  request.onsuccess = () => {
    const current = request.result;
    if (current && current.status !== "recording" && !current.summary) {
      store.put({ ...current, gameSummary: gameSummary || current.gameSummary || null, summary, serverSyncedAt: null, serverSyncedBy: null });
    }
  };
  await done;
}

export async function markResearchSummarySynced(sessionId, summary, email, uploadedAt) {
  const database = await openResearchDatabase();
  const transaction = database.transaction("sessions", "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore("sessions");
  const request = store.get(sessionId);
  request.onsuccess = () => {
    const current = request.result;
    if (current?.summary && JSON.stringify(current.summary) === JSON.stringify(summary)) {
      store.put({ ...current, serverSyncedAt: uploadedAt, serverSyncedBy: email });
    }
  };
  await done;
}
