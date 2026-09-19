import { verifyPassword } from "@/lib/auth/password";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { findUser, isStorageError, recordLogin } from "@/lib/auth/store";

export async function POST(request) {
  const limit = rateLimit(clientKey(request, "login"), 10, 60_000);
  if (!limit.ok) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password) {
    return Response.json({ error: "missing_credentials" }, { status: 400 });
  }

  const user = await findUser(email);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  try {
    await recordLogin(email);
  } catch (err) {
    if (!isStorageError(err)) throw err;
  }
  await createSession(email);
  return Response.json({ user: { email, name: user.name || null } });
}
