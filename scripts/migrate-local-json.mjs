import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDataDirectory, getResearchDataDirectory, validateStudyConfig } from "../lib/server-config.js";
import { getDatabase } from "../lib/server-database.js";

async function readOptionalJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function readLocalData() {
  const [users, research, settings] = await Promise.all([
    readOptionalJson(path.join(getDataDirectory(), "users.json")),
    readOptionalJson(path.join(getResearchDataDirectory(), "research-summaries.json")),
    readOptionalJson(path.join(getDataDirectory(), "study-settings.json")),
  ]);
  if (users !== undefined && (!users || typeof users !== "object" || Array.isArray(users))) throw new Error("Invalid users.json");
  if (research !== undefined && (research?.version !== 1 || !Array.isArray(research.records))) throw new Error("Invalid research-summaries.json");
  if (settings !== undefined && settings?.version !== 1) throw new Error("Invalid study-settings.json");

  const accounts = Object.entries(users || {}).map(([email, user]) => {
    if (!user || user.email !== email || typeof user.passwordHash !== "string" || !user.passwordHash) {
      throw new Error("Invalid account in users.json");
    }
    return user;
  });
  const records = research?.records || [];
  for (const record of records) {
    if (!record || typeof record.recordId !== "string" || !record.recordId || typeof record.participantId !== "string" || !record.participantId || typeof record.uploadedBy !== "string" || !record.uploadedBy || typeof record.uploadedAt !== "string" || !record.summary || typeof record.summary !== "object" || Array.isArray(record.summary)) {
      throw new Error("Invalid record in research-summaries.json");
    }
  }
  return { accounts, records, study: settings ? validateStudyConfig(settings.study) : null };
}

export async function migrateLocalData(data, sql) {
  const imported = { accounts: 0, records: 0, study: 0 };
  for (const user of data.accounts) {
    const rows = await sql`INSERT INTO cogniload_users (email, name, password_hash, created_at, login_count, last_login_at)
      VALUES (${user.email}, ${user.name || null}, ${user.passwordHash}, ${user.createdAt || null}, ${user.loginCount || 0}, ${user.lastLoginAt || null})
      ON CONFLICT (email) DO NOTHING RETURNING email`;
    imported.accounts += rows.length;
  }
  for (const record of data.records) {
    const rows = await sql`INSERT INTO cogniload_research_records (record_id, participant_id, uploaded_by, uploaded_at, summary)
      VALUES (${record.recordId}, ${record.participantId}, ${record.uploadedBy}, ${record.uploadedAt}, ${JSON.stringify(record.summary)}::jsonb)
      ON CONFLICT (record_id) DO NOTHING RETURNING record_id`;
    imported.records += rows.length;
  }
  if (data.study) {
    const rows = await sql`INSERT INTO cogniload_settings (key, value) VALUES ('study', ${JSON.stringify(data.study)}::jsonb)
      ON CONFLICT (key) DO NOTHING RETURNING key`;
    imported.study = rows.length;
  }
  return imported;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) throw new Error("Usage: node scripts/migrate-local-json.mjs [--apply]");
  const data = await readLocalData();
  const found = { accounts: data.accounts.length, records: data.records.length, study: Number(Boolean(data.study)) };
  console.log("Local JSON:", found);
  if (!args.includes("--apply")) {
    console.log("Dry run only. Set DATABASE_URL and add --apply to import missing rows.");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for import");
  const imported = await migrateLocalData(data, await getDatabase());
  console.log("Imported:", imported);
  console.log("Existing rows were left unchanged. Keep the JSON files as a backup until verified.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
