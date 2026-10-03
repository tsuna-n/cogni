import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { createUser, findUser, isStorageError, listManagedUsers } from "@/lib/auth/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { isAdminUser } from "@/lib/auth/roles.mjs";
import { readUserForms } from "@/lib/forms/store";

export const runtime = "nodejs";
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { ...privateResponseHeaders, ...headers } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const { user: admin, response } = await authorizeUser({ adminOnly: true });
    if (response) return response;
    const origin = request.headers.get("origin");
    if (origin) {
      let source;
      try { source = new URL(origin); } catch { return json({ error: "forbidden" }, 403); }
      const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.slice(0, -1);
      if (source.host !== request.headers.get("host") || source.protocol !== `${protocol}:`) return json({ error: "forbidden" }, 403);
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "invalid_body" }, 415);
    if (Number(request.headers.get("content-length")) > 16_384) return json({ error: "invalid_body" }, 413);
    const raw = await request.text();
    if (raw.length > 16_384) return json({ error: "invalid_body" }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["email", "name", "password", "role", "adminEmail", "adminPassword"].includes(key))) return json({ error: "invalid_body" }, 400);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "invalid_email" }, 400);
    if ((body.name !== undefined && typeof body.name !== "string") || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return json({ error: "invalid_name" }, 400);
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 200) return json({ error: "weak_password" }, 400);
    if (!["user", "researcher", "admin"].includes(body.role)) return json({ error: "invalid_role" }, 400);
    if (typeof body.adminEmail !== "string" || body.adminEmail.length > 254 || typeof body.adminPassword !== "string" || !body.adminPassword || body.adminPassword.length > 200) return json({ error: "missing_admin_credentials" }, 400);

    const limit = await rateLimit(`admin-create-user:${admin.email}`, 10, 60_000);
    if (!limit.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfter) });
    // Reconfirm the signed-in administrator, never a different account supplied by the client.
    const account = await findUser(admin.email);
    if (body.adminEmail.trim().toLowerCase() !== admin.email || !isAdminUser(account) ||
      !await verifyPassword(body.adminPassword, account.passwordHash)) return json({ error: "invalid_admin_credentials" }, 403);

    const user = {
      email, name: name || null, role: body.role,
      createdAt: new Date().toISOString(), loginCount: 0, lastLoginAt: null,
      profile: {}, profileUpdatedAt: null, profileUpdatedBy: null,
    };
    const result = await createUser({ ...user, passwordHash: await hashPassword(body.password) });
    if (!result.ok) return json({ error: "email_taken" }, 409);
    return json({ user: { ...user, participantId: (await findUser(email)).participantId } }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "invalid_body" }, 400);
    if (isStorageError(error)) return json({ error: "storage_unavailable" }, 503);
    throw error;
  }
}

export async function GET() {
  try {
    const { response } = await authorizeUser({ manageUsers: true });
    if (response) return response;
    const users = await listManagedUsers();
    return Response.json({ users: await Promise.all(users.map(async (user) => ({ ...user, forms: await readUserForms(user.email) }))) }, { headers: privateResponseHeaders });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503, headers: privateResponseHeaders });
    throw error;
  }
}
