import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { isStorageError } from "@/lib/auth/store";
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
  const { response } = await authorizeUser({ adminOnly: true });
  if (response) return response;
  const { id } = await params;
  if (!id || id.length > 40) return Response.json({ error: "invalid_id" }, { status: 400 });
  return Response.json({ records: await listParticipantRecords(id) }, { headers: privateResponseHeaders });
}
