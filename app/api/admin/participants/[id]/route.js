import { getSession } from "@/lib/auth/session";
import { findUser, isAdminEmail, isStorageError } from "@/lib/auth/store";
import { listParticipantRecords } from "@/lib/research/server-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    return await getParticipantRecords(params);
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
}

async function getParticipantRecords(params) {
  const session = await getSession();
  if (!session || !(await findUser(session.email))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (!id || id.length > 40) return Response.json({ error: "invalid_id" }, { status: 400 });
  return Response.json({ records: await listParticipantRecords(id) }, { headers: { "Cache-Control": "no-store" } });
}
