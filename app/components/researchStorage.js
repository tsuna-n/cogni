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
  transaction.objectStore("sessions").put(session);
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

export async function getResearchChunks(sessionId) {
  const database = await openResearchDatabase();
  const transaction = database.transaction("chunks", "readonly");
  const request = transaction.objectStore("chunks").index("sessionId").getAll(IDBKeyRange.only(sessionId));
  const done = transactionDone(transaction);
  await done;
  return request.result.sort((a, b) => a.sequence - b.sequence);
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
