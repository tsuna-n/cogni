import { promises as fs } from "node:fs";
import path from "node:path";
import { hashPassword } from "./password.js";
import { getDataDirectory } from "../server-config.js";
import { getDatabase } from "../server-database.js";

const dataDir = () => getDataDirectory();
const usersFile = () => path.join(dataDir(), "users.json");

let writeQueue = Promise.resolve();
let researcherUsersPromise = null;
let adminUsersPromise = null;

function parseConfiguredUsers(raw, role, minimumPasswordLength) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(":");
      if (sep <= 0) return null;
      const email = entry.slice(0, sep).trim().toLowerCase();
      const password = entry.slice(sep + 1);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < minimumPasswordLength) return null;
      return { email, password, role };
    })
    .filter(Boolean);
}

function getResearcherUsers() {
  if (!researcherUsersPromise) {
    researcherUsersPromise = Promise.all(
      [
        ...parseConfiguredUsers(process.env.RESEARCHER_USERS, "researcher", 12),
        ...parseConfiguredUsers(process.env.DEMO_USERS, "researcher", 1),
      ].map(async (entry) => ({
        email: entry.email,
        name: entry.email.split("@")[0],
        passwordHash: await hashPassword(entry.password),
        role: entry.role,
        createdAt: null,
        loginCount: 0,
        lastLoginAt: null,
      }))
    );
  }
  return researcherUsersPromise;
}

function getAdminUsers() {
  if (!adminUsersPromise) {
    adminUsersPromise = Promise.all(
      parseConfiguredUsers(process.env.ADMIN_USERS, "admin", 12).map(async (entry) => ({
        email: entry.email,
        name: entry.email.split("@")[0],
        passwordHash: await hashPassword(entry.password),
        role: "admin",
        createdAt: null,
        loginCount: 0,
        lastLoginAt: null,
      }))
    );
  }
  return adminUsersPromise;
}

export function isAdminEmail(email) {
  return parseConfiguredUsers(process.env.ADMIN_USERS, "admin", 12).some((entry) => entry.email === String(email || "").toLowerCase());
}

async function findAdminUser(email) {
  const admins = await getAdminUsers();
  return admins.find((user) => user.email === email) || null;
}

async function findResearcherUser(email) {
  const users = await getResearcherUsers();
  return users.find((user) => user.email === email) || null;
}

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
    createdAt: row.created_at,
    loginCount: row.login_count,
    lastLoginAt: row.last_login_at,
  } : null;
}

export async function findUser(email) {
  const adminUser = await findAdminUser(email);
  if (adminUser) return adminUser;
  const researcherUser = await findResearcherUser(email);
  if (researcherUser) return researcherUser;
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT * FROM cogniload_users WHERE email = ${email}`;
    return databaseUser(rows[0]);
  }
  const users = await readUsers();
  return users[email] || null;
}

export async function createUser(user) {
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`INSERT INTO cogniload_users (email, name, password_hash, created_at, login_count, last_login_at)
      VALUES (${user.email}, ${user.name}, ${user.passwordHash}, ${user.createdAt}, 0, NULL)
      ON CONFLICT (email) DO NOTHING RETURNING email`;
    return rows.length ? { ok: true, user } : { ok: false, reason: "exists" };
  }
  return mutate(async () => {
    const users = await readUsers();
    if (users[user.email]) return { ok: false, reason: "exists" };
    users[user.email] = user;
    await writeUsers(users);
    return { ok: true, user };
  });
}

export async function recordLogin(email) {
  const adminUser = await findAdminUser(email);
  if (adminUser) return adminUser;
  const researcherUser = await findResearcherUser(email);
  if (researcherUser) return researcherUser;
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
    return user;
  });
}
