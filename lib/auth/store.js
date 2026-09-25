import { promises as fs } from "node:fs";
import path from "node:path";
import { hashPassword } from "./password.js";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

let writeQueue = Promise.resolve();
let demoUsersPromise = null;
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

function getDemoUsers() {
  if (!demoUsersPromise) {
    demoUsersPromise = Promise.all(
      parseConfiguredUsers(process.env.DEMO_USERS, "researcher", 1).map(async (entry) => ({
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
  return demoUsersPromise;
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

async function findDemoUser(email) {
  const demoUsers = await getDemoUsers();
  return demoUsers.find((user) => user.email === email) || null;
}

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeUsers(users) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${USERS_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await fs.rename(tmp, USERS_FILE);
}

function mutate(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

export function isStorageError(error) {
  return ["EROFS", "EACCES", "EPERM", "ENOSPC", "EXDEV"].includes(error?.code);
}

export async function findUser(email) {
  const adminUser = await findAdminUser(email);
  if (adminUser) return adminUser;
  const demoUser = await findDemoUser(email);
  if (demoUser) return demoUser;
  const users = await readUsers();
  return users[email] || null;
}

export async function createUser(user) {
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
  const demoUser = await findDemoUser(email);
  if (demoUser) return demoUser;
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
