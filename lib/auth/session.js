import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

const COOKIE_NAME = "cogni_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SECRET_FILE = path.join(process.cwd(), "data", "session-secret");

let cachedSecret = null;

async function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  try {
    cachedSecret = (await fs.readFile(SECRET_FILE, "utf8")).trim();
  } catch {
    cachedSecret = randomBytes(32).toString("hex");
    await fs.mkdir(path.dirname(SECRET_FILE), { recursive: true });
    await fs.writeFile(SECRET_FILE, cachedSecret, { mode: 0o600 });
  }
  if (!cachedSecret) throw new Error("Unable to initialise session secret");
  return cachedSecret;
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

async function sign(payload) {
  const secret = await getSecret();
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const secret = await getSecret();
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.email || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(email) {
  const token = await sign({ email, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
