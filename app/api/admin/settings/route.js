import { getSession } from "@/lib/auth/session";
import { findUser, isAdminEmail, isStorageError } from "@/lib/auth/store";
import { getEffectiveStudyConfig, resetStudyConfig, saveStudyConfig } from "@/lib/research/study-settings-store";
import { StudyConfigError } from "@/lib/server-config";

async function authorized() {
  try {
    const session = await getSession();
    if (!session || !(await findUser(session.email))) return 401;
    if (!isAdminEmail(session.email)) return 403;
    return 200;
  } catch (error) {
    if (isStorageError(error)) return 503;
    throw error;
  }
}

function authorizationError(status) {
  return Response.json({ error: status === 503 ? "settings_unavailable" : status === 401 ? "unauthorized" : "forbidden" }, { status });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);
    return source.host === request.headers.get("host") && source.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const status = await authorized();
  if (status !== 200) return authorizationError(status);
  try {
    return Response.json(await getEffectiveStudyConfig(), { headers: noStore });
  } catch (error) {
    console.error("Cannot read study settings:", error);
    return Response.json({ error: "settings_unavailable" }, { status: 503 });
  }
}

export async function PUT(request) {
  const status = await authorized();
  if (status !== 200) return authorizationError(status);
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "invalid_body" }, { status: 415 });
  if (Number(request.headers.get("content-length")) > 4096) return Response.json({ error: "invalid_body" }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "invalid_body" }, { status: 413 });
    return Response.json(await saveStudyConfig(JSON.parse(raw)), { headers: noStore });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof StudyConfigError) {
      return Response.json({ error: "invalid_settings", detail: error.message }, { status: 400 });
    }
    if (isStorageError(error)) return Response.json({ error: "settings_unavailable" }, { status: 503 });
    throw error;
  }
}

export async function DELETE(request) {
  const status = await authorized();
  if (status !== 200) return authorizationError(status);
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  try {
    return Response.json(await resetStudyConfig(), { headers: noStore });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "settings_unavailable" }, { status: 503 });
    throw error;
  }
}
