import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const dataDirectory = () => process.env.RESEARCH_DATA_DIR || path.join(process.cwd(), "data");
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

export function saveResearchRecord(submission, uploadedBy) {
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
  await writeQueue;
  const records = await readRecords();
  return records.filter((record) => record.participantId === id).sort((a, b) => b.summary.startedMs - a.summary.startedMs);
}
