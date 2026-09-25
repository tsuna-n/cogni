import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLocalData, migrateLocalData } from "../scripts/migrate-local-json.mjs";

test("local JSON import preserves existing rows and can resume", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cogniload-import-"));
  const previous = process.env.COGNILOAD_DATA_DIR;
  process.env.COGNILOAD_DATA_DIR = directory;
  try {
    const account = { email: "researcher@example.org", name: "Researcher", passwordHash: "scrypt:test", createdAt: "2026-01-01T00:00:00.000Z", loginCount: 2, lastLoginAt: null };
    const record = { recordId: "record-1", participantId: "p-1", uploadedBy: account.email, uploadedAt: "2026-01-01T00:00:00.000Z", summary: { startedMs: 100, protocolVersion: "pilot_1" } };
    const study = { baselineSeconds: 40, postTaskSeconds: 20, maxTaskSeconds: 300, defaultTaskSeconds: 90, protocolVersion: "pilot_1" };
    await Promise.all([
      fs.writeFile(path.join(directory, "users.json"), JSON.stringify({ [account.email]: account })),
      fs.writeFile(path.join(directory, "research-summaries.json"), JSON.stringify({ version: 1, records: [record] })),
      fs.writeFile(path.join(directory, "study-settings.json"), JSON.stringify({ version: 1, study })),
    ]);
    const data = await readLocalData();
    assert.equal(data.accounts.length, 1);
    assert.equal(data.records.length, 1);
    assert.deepEqual(data.study, study);

    const database = { users: new Map(), records: new Map(), settings: new Map() };
    const sql = async (parts, ...values) => {
      const query = parts.join("?");
      if (query.startsWith("INSERT INTO cogniload_users")) {
        if (database.users.has(values[0])) return [];
        database.users.set(values[0], values);
        return [{ email: values[0] }];
      }
      if (query.startsWith("INSERT INTO cogniload_research_records")) {
        if (database.records.has(values[0])) return [];
        database.records.set(values[0], values);
        return [{ record_id: values[0] }];
      }
      if (query.startsWith("INSERT INTO cogniload_settings")) {
        if (database.settings.has("study")) return [];
        database.settings.set("study", JSON.parse(values[0]));
        return [{ key: "study" }];
      }
      throw new Error(`Unexpected query: ${query}`);
    };
    assert.deepEqual(await migrateLocalData(data, sql), { accounts: 1, records: 1, study: 1 });
    assert.deepEqual(await migrateLocalData(data, sql), { accounts: 0, records: 0, study: 0 });
    assert.deepEqual(database.settings.get("study"), study);
    assert.equal(database.records.get("record-1")[3], record.uploadedAt);
    assert.equal(database.users.get(account.email)[4], 2);
  } finally {
    if (previous === undefined) delete process.env.COGNILOAD_DATA_DIR;
    else process.env.COGNILOAD_DATA_DIR = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
