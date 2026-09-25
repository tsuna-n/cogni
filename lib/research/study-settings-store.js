import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDataDirectory, getStudyConfig, validateStudyConfig } from "../server-config.js";
import { getDatabase } from "../server-database.js";

const settingsFile = () => path.join(getDataDirectory(), "study-settings.json");
let writeQueue = Promise.resolve();

export async function getEffectiveStudyConfig() {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT value FROM cogniload_settings WHERE key = 'study'`;
    return rows.length ? { study: validateStudyConfig(rows[0].value), source: "saved" } : { study: getStudyConfig(), source: "environment" };
  }
  try {
    const saved = JSON.parse(await fs.readFile(settingsFile(), "utf8"));
    if (saved?.version !== 1) throw new Error("Invalid study settings file version");
    return { study: validateStudyConfig(saved.study), source: "saved" };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { study: getStudyConfig(), source: "environment" };
  }
}

export function saveStudyConfig(input) {
  const study = validateStudyConfig(input);
  return saveValidatedStudyConfig(study);
}

async function saveValidatedStudyConfig(study) {
  const sql = await getDatabase();
  if (sql) {
    await sql`INSERT INTO cogniload_settings (key, value) VALUES ('study', ${JSON.stringify(study)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return { study, source: "saved" };
  }
  const run = writeQueue.then(async () => {
    const directory = getDataDirectory();
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, `study-settings.${process.pid}.${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify({ version: 1, study }), { mode: 0o600 });
      await fs.rename(temporary, settingsFile());
      return { study, source: "saved" };
    } catch (error) {
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
  });
  writeQueue = run.catch(() => {});
  return run;
}

export function resetStudyConfig() {
  const study = getStudyConfig();
  return resetValidatedStudyConfig(study);
}

async function resetValidatedStudyConfig(study) {
  const sql = await getDatabase();
  if (sql) {
    await sql`DELETE FROM cogniload_settings WHERE key = 'study'`;
    return { study, source: "environment" };
  }
  const run = writeQueue.then(async () => {
    await fs.unlink(settingsFile()).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    return { study, source: "environment" };
  });
  writeQueue = run.catch(() => {});
  return run;
}
