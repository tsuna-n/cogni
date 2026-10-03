import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { isStorageError } from "@/lib/auth/store";
import { listResearchRecords, saveResearchRecord } from "@/lib/research/server-store";
import { normalizeResearchSubmission, ResearchValidationError } from "@/lib/research/validation";
import { taskPerformance } from "@/lib/research/task-performance.mjs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { user, response } = await authorizeUser();
    if (response) return response;
    const records = await listResearchRecords(user);
    return Response.json({ records, taskPerformance: taskPerformance(records, user.email) }, { headers: privateResponseHeaders });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
}

export async function POST(request) {
  try {
    return await saveSummary(request);
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
}

async function saveSummary(request) {
  const { user, response } = await authorizeUser();
  if (response) return response;
  if (user.screeningRequired) return Response.json({ error: 'screening_required' }, { status: 403 });
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
    if (user.role === 'user' && !submission.summary.testMode && submission.participantId !== user.participantId) return Response.json({ error: 'invalid_participant' }, { status: 403 });
  } catch (error) {
    if (error instanceof ResearchValidationError || error instanceof SyntaxError) return Response.json({ error: "invalid_body", detail: error.message }, { status: 400 });
    throw error;
  }
  try {
    const result = await saveResearchRecord(submission, user.email);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
    return Response.json({ recordId: result.record.recordId, uploadedAt: result.record.uploadedAt, uploadedBy: result.record.uploadedBy }, { headers: privateResponseHeaders });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
}
