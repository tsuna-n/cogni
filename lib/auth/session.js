import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { getDataDirectory } from "../server-config.js";

const COOKIE_NAME = "cogni_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const secretFile = () => path.join(getDataDirectory(), "session-secret");

let secretPromise = null;

export function assertSessionSecretConfigured() {
  if (process.env.VERCEL && !process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required on Vercel");
  if (process.env.SESSION_SECRET && (process.env.NODE_ENV === "production" || process.env.VERCEL) && process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
  }
}

async function getSecret() {
  assertSessionSecretConfigured();
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (!secretPromise) {
    secretPromise = (async () => {
      try {
        const existing = (await fs.readFile(secretFile(), "utf8")).trim();
        if (!existing) throw new Error("Session secret file is empty");
        return existing;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const generated = randomBytes(32).toString("hex");
      await fs.mkdir(path.dirname(secretFile()), { recursive: true, mode: 0o700 });
      try {
        await fs.writeFile(secretFile(), generated, { mode: 0o600, flag: "wx" });
        return generated;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const existing = (await fs.readFile(secretFile(), "utf8")).trim();
        if (!existing) throw new Error("Session secret file is empty");
        return existing;
      }
    })().catch((error) => {
      secretPromise = null;
      throw error;
    });
  }
  return secretPromise;
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
