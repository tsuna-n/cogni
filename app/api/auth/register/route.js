import { hashPassword } from "@/lib/auth/password";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { createUser, findUser, isStorageError } from "@/lib/auth/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const limit = rateLimit(clientKey(request, "register"), 8, 60_000);
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
  const name = String(body?.name || "").trim();

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }
  if (name.length > 80) {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return Response.json({ error: "weak_password" }, { status: 400 });
  }
  if (await findUser(email)) {
    return Response.json({ error: "email_taken" }, { status: 409 });
  }

  const user = {
    email,
    name: name || null,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    loginCount: 0,
    lastLoginAt: null,
  };

  try {
    const result = await createUser(user);
    if (!result.ok) {
      return Response.json({ error: "email_taken" }, { status: 409 });
    }

    await createSession(email);
    return Response.json({ user: { email, name: user.name, role: "researcher" } }, { status: 201 });
  } catch (err) {
    if (isStorageError(err)) {
      return Response.json({ error: "storage_unavailable" }, { status: 503 });
    }
    throw err;
  }
}
