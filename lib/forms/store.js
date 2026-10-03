import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../server-database.js";
import { getDataDirectory } from "../server-config.js";

let queue = Promise.resolve();
const file = () => path.join(getDataDirectory(), "user-forms.json");
async function readLocal() {
  try { return JSON.parse(await fs.readFile(file(), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}
async function changeLocal(task) {
  const run = queue.then(async () => {
    const forms = await readLocal();
    const result = task(forms);
    await fs.mkdir(getDataDirectory(), { recursive: true, mode: 0o700 });
    const tmp = `${file()}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(forms), { mode: 0o600 });
    await fs.rename(tmp, file());
    return result;
  });
  queue = run.catch(() => {});
  return run;
}
export async function readUserForms(email) {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT form_key, value FROM cogniload_user_forms WHERE email = ${email}`;
    return Object.fromEntries(rows.map((row) => [row.form_key, row.value]));
  }
  await queue;
  return (await readLocal())[email] || {};
}
export async function saveUserForm(email, key, value) {
  const sql = await getDatabase();
  if (sql) {
    await sql`INSERT INTO cogniload_user_forms (email, form_key, value, updated_at)
      VALUES (${email}, ${key}, ${JSON.stringify(value)}::jsonb, ${new Date().toISOString()})
      ON CONFLICT (email, form_key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
    return;
  }
  await changeLocal((forms) => {
    forms[email] ||= {};
    forms[email][key] = value;
  });
}
export async function confirmScreening(email, submission, participantId) {
  const entry = { ...submission, participantId, submittedAt: new Date().toISOString() };
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`INSERT INTO cogniload_user_forms (email, form_key, value, updated_at)
      VALUES (${email}, 'screeningHistory', ${JSON.stringify({ [entry.id]: entry })}::jsonb, ${entry.submittedAt})
      ON CONFLICT (email, form_key) DO UPDATE
      SET value = EXCLUDED.value || cogniload_user_forms.value, updated_at = EXCLUDED.updated_at RETURNING value`;
    return rows[0].value[entry.id];
  }
  return changeLocal((forms) => {
    forms[email] ||= {};
    forms[email].screeningHistory ||= {};
    if (!Object.hasOwn(forms[email].screeningHistory, entry.id)) forms[email].screeningHistory[entry.id] = entry;
    return forms[email].screeningHistory[entry.id];
  });
}
