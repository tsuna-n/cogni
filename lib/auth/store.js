import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

let writeQueue = Promise.resolve();

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

export async function findUser(email) {
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
