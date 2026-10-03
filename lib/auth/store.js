import { promises as fs } from "node:fs";
import path from "node:path";
import { getDataDirectory } from "../server-config.js";
import { getDatabase } from "../server-database.js";
import { getUserRole } from "./roles.mjs";
import { PROFILE_KEYS } from "./user-profile.mjs";

const dataDir = () => getDataDirectory();
const usersFile = () => path.join(dataDir(), "users.json");

let writeQueue = Promise.resolve();

async function readUsers() {
  try {
    const raw = await fs.readFile(usersFile(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeUsers(users) {
  await fs.mkdir(dataDir(), { recursive: true, mode: 0o700 });
  const tmp = `${usersFile()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, usersFile());
}

function mutate(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

export function isStorageError(error) {
  return error?.name === "NeonDbError" || error?.message === "fetch failed" ||
    ["EROFS", "EACCES", "EPERM", "ENOSPC", "EXDEV", "STORAGE_UNAVAILABLE", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(error?.code) ||
    (error?.cause ? isStorageError(error.cause) : false);
}

function databaseUser(row) {
  return row ? {
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: getUserRole(row),
    createdAt: row.created_at,
    loginCount: row.login_count,
    lastLoginAt: row.last_login_at,
    participantId: participantId(row.participant_number),
    profile: row.profile || {},
  } : null;
}

function participantId(number) {
  return number == null ? null : `P${String(number).padStart(3, "0")}`;
}

async function numberedUsers() {
  return mutate(async () => {
    const users = await readUsers();
    let next = Math.max(0, ...Object.values(users).map((user) => Number(user.participantNumber) || 0));
    let changed = false;
    for (const user of Object.values(users).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.email.localeCompare(b.email))) {
      if (!user.participantNumber) { user.participantNumber = ++next; changed = true; }
    }
    if (changed) await writeUsers(users);
    return users;
  });
}

export async function findUser(email) {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT * FROM cogniload_users WHERE email = ${email}`;
    return databaseUser(rows[0]);
  }
  const users = await numberedUsers();
  const user = Object.hasOwn(users, email) ? users[email] : null;
  return user ? { ...user, participantId: participantId(user.participantNumber), role: getUserRole(user) } : null;
}

export async function createUser(user) {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`INSERT INTO cogniload_users (email, name, password_hash, created_at, login_count, last_login_at, role)
      VALUES (${user.email}, ${user.name}, ${user.passwordHash}, ${user.createdAt}, 0, NULL, ${getUserRole(user)})
      ON CONFLICT (email) DO NOTHING RETURNING email`;
    return rows.length ? { ok: true, user } : { ok: false, reason: "exists" };
  }
  await numberedUsers();
  return mutate(async () => {
    const users = await readUsers();
    if (users[user.email]) return { ok: false, reason: "exists" };
    const next = Math.max(0, ...Object.values(users).map((account) => Number(account.participantNumber) || 0)) + 1;
    users[user.email] = { ...user, participantNumber: next, role: getUserRole(user) };
    await writeUsers(users);
    return { ok: true, user: { ...users[user.email], participantId: participantId(next) } };
  });
}

export async function recordLogin(email) {
  const sql = await getDatabase();
  if (sql) {
    const now = new Date().toISOString();
    const rows = await sql`UPDATE cogniload_users SET login_count = login_count + 1, last_login_at = ${now}
      WHERE email = ${email} RETURNING *`;
    return databaseUser(rows[0]);
  }
  return mutate(async () => {
    const users = await readUsers();
    const user = users[email];
    if (!user) return null;
    user.lastLoginAt = new Date().toISOString();
    user.loginCount = (user.loginCount || 0) + 1;
    await writeUsers(users);
    return { ...user, role: getUserRole(user) };
  });
}

function managedUser(user) {
  const source = user.profile || {};
  return {
    email: user.email,
    name: user.name || null,
    role: getUserRole(user),
    participantId: user.participantId || participantId(user.participantNumber ?? user.participant_number),
    createdAt: user.createdAt ?? user.created_at ?? null,
    loginCount: user.loginCount ?? user.login_count ?? 0,
    lastLoginAt: user.lastLoginAt ?? user.last_login_at ?? null,
    profile: Object.fromEntries(PROFILE_KEYS.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]])),
    profileUpdatedAt: user.profileUpdatedAt ?? user.profile_updated_at ?? null,
    profileUpdatedBy: user.profileUpdatedBy ?? user.profile_updated_by ?? null,
  };
}

export async function listManagedUsers() {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT email, name, role, created_at, login_count, last_login_at,
      profile, profile_updated_at, profile_updated_by, participant_number FROM cogniload_users ORDER BY participant_number`;
    return rows.map(managedUser);
  }
  await writeQueue;
  return Object.values(await numberedUsers()).map(managedUser).sort((a, b) => a.participantId.localeCompare(b.participantId, undefined, { numeric: true }));
}

export async function updateManagedUser(email, changes, editorEmail) {
  const sql = await getDatabase();
  // Keep revisions distinct even when two saves occur within a millisecond.
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(changes.expectedUpdatedAt || "") + 1 || 0)).toISOString();
  if (sql) {
    const rows = await sql`UPDATE cogniload_users SET name = ${changes.name},
      profile = ${JSON.stringify(changes.profile)}::jsonb,
      profile_updated_at = ${updatedAt}, profile_updated_by = ${editorEmail}
      WHERE email = ${email} AND profile_updated_at IS NOT DISTINCT FROM ${changes.expectedUpdatedAt}
      RETURNING email, name, role, created_at, login_count, last_login_at,
        profile, profile_updated_at, profile_updated_by, participant_number`;
    if (rows.length) return { ok: true, user: managedUser(rows[0]) };
    return { ok: false, reason: (await findUser(email)) ? "profile_conflict" : "not_found" };
  }
  return mutate(async () => {
    const users = await readUsers();
    const user = Object.hasOwn(users, email) ? users[email] : null;
    if (!user) return { ok: false, reason: "not_found" };
    if ((user.profileUpdatedAt ?? null) !== changes.expectedUpdatedAt) return { ok: false, reason: "profile_conflict" };
    users[email] = { ...user, name: changes.name, profile: changes.profile, profileUpdatedAt: updatedAt, profileUpdatedBy: editorEmail };
    await writeUsers(users);
    return { ok: true, user: managedUser(users[email]) };
  });
}
