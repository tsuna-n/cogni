import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getResearchDataDirectory } from "../server-config.js";
import { getDatabase } from "../server-database.js";

const dataDirectory = () => getResearchDataDirectory();
const dataFile = () => path.join(dataDirectory(), "research-summaries.json");
let writeQueue = Promise.resolve();

async function readRecords() {
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile(), "utf8"));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.records)) throw new Error("Invalid research data file");
    return parsed.records;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeRecords(records) {
  const directory = dataDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `research-summaries.${process.pid}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, JSON.stringify({ version: 1, records }), { mode: 0o600 });
    await fs.rename(temporary, dataFile());
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function saveResearchRecord(submission, uploadedBy) {
  const sql = await getDatabase();
  if (sql) {
    const uploadedAt = new Date().toISOString();
    const rows = await sql`INSERT INTO cogniload_research_records
      (record_id, participant_id, uploaded_by, uploaded_at, summary)
      VALUES (${submission.recordId}, ${submission.participantId}, ${uploadedBy}, ${uploadedAt}, ${JSON.stringify(submission.summary)}::jsonb)
      ON CONFLICT (record_id) DO UPDATE SET summary = EXCLUDED.summary
      WHERE cogniload_research_records.uploaded_by = EXCLUDED.uploaded_by
        AND cogniload_research_records.participant_id = EXCLUDED.participant_id
      RETURNING uploaded_at`;
    if (!rows.length) return { ok: false, reason: "record_conflict" };
    return { ok: true, record: { ...submission, uploadedBy, uploadedAt: rows[0].uploaded_at } };
  }
  const task = writeQueue.then(async () => {
    const records = await readRecords();
    const existing = records.find((record) => record.recordId === submission.recordId);
    if (existing && (existing.uploadedBy !== uploadedBy || existing.participantId !== submission.participantId)) {
      return { ok: false, reason: "record_conflict" };
    }
    const record = {
      ...submission,
      uploadedBy,
      uploadedAt: existing?.uploadedAt || new Date().toISOString(),
    };
    if (existing) records[records.indexOf(existing)] = record;
    else records.push(record);
    await writeRecords(records);
    return { ok: true, record };
  });
  writeQueue = task.catch(() => {});
  return task;
}

export async function listParticipants(query = "") {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT participant_id AS id, COUNT(*)::integer AS session_count
      FROM cogniload_research_records
      WHERE POSITION(LOWER(${query}) IN LOWER(participant_id)) > 0
      GROUP BY participant_id ORDER BY participant_id`;
    return rows.map((row) => ({ id: row.id, sessionCount: row.session_count }));
  }
  await writeQueue;
  const records = await readRecords();
  const needle = query.toLocaleLowerCase();
  const counts = new Map();
  for (const record of records) {
    if (!record.participantId.toLocaleLowerCase().includes(needle)) continue;
    counts.set(record.participantId, (counts.get(record.participantId) || 0) + 1);
  }
  return [...counts].map(([id, sessionCount]) => ({ id, sessionCount })).sort((a, b) => a.id.localeCompare(b.id));
}

export async function listParticipantRecords(id) {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT record_id, participant_id, uploaded_by, uploaded_at, summary
      FROM cogniload_research_records WHERE participant_id = ${id}
      ORDER BY (summary->>'startedMs')::bigint DESC`;
    return rows.map((row) => ({
      recordId: row.record_id,
      participantId: row.participant_id,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      summary: row.summary,
    }));
  }
  await writeQueue;
  const records = await readRecords();
  return records.filter((record) => record.participantId === id).sort((a, b) => b.summary.startedMs - a.summary.startedMs);
}
