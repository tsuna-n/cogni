import { getSession } from "@/lib/auth/session";
import { findUser, isStorageError } from "@/lib/auth/store";
import { saveResearchRecord } from "@/lib/research/server-store";
import { normalizeResearchSubmission, ResearchValidationError } from "@/lib/research/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();
  if (!session || !(await findUser(session.email))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin) {
    let source;
    try { source = new URL(origin); } catch { return Response.json({ error: "forbidden" }, { status: 403 }); }
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.slice(0, -1);
    if (source.host !== request.headers.get("host") || source.protocol !== `${protocol}:`) return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ error: "invalid_body" }, { status: 415 });
  if (Number(request.headers.get("content-length")) > 16_384) return Response.json({ error: "invalid_body" }, { status: 413 });
  let submission;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return Response.json({ error: "invalid_body" }, { status: 413 });
    submission = normalizeResearchSubmission(JSON.parse(raw));
  } catch (error) {
    if (error instanceof ResearchValidationError || error instanceof SyntaxError) return Response.json({ error: "invalid_body", detail: error.message }, { status: 400 });
    throw error;
  }
  try {
    const result = await saveResearchRecord(submission, session.email);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
    return Response.json({ recordId: result.record.recordId, uploadedAt: result.record.uploadedAt, uploadedBy: result.record.uploadedBy }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
}
