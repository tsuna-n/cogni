import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { isStorageError, updateManagedUser } from "@/lib/auth/store";
import { normalizeUserProfile, UserProfileError } from "@/lib/auth/user-profile.mjs";

export const runtime = "nodejs";
const json = (data, status = 200) => Response.json(data, { status, headers: privateResponseHeaders });

export async function PUT(request, { params }) {
  try {
    const { user, response } = await authorizeUser({ manageUsers: true });
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
    const changes = normalizeUserProfile(JSON.parse(raw));
    const { email } = await params;
    const result = await updateManagedUser(email, changes, user.email);
    if (!result.ok) return json({ error: result.reason }, result.reason === "not_found" ? 404 : 409);
    return json({ user: result.user });
  } catch (error) {
    if (error instanceof UserProfileError || error instanceof SyntaxError) return json({ error: "invalid_body", detail: error.message }, 400);
    if (isStorageError(error)) return json({ error: "storage_unavailable" }, 503);
    throw error;
  }
}
