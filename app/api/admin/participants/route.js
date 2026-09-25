import { getSession } from "@/lib/auth/session";
import { findUser, isAdminEmail } from "@/lib/auth/store";
import { listParticipants } from "@/lib/research/server-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getSession();
  if (!session || !(await findUser(session.email))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "forbidden" }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q") || "";
  if (query.length > 40) return Response.json({ error: "invalid_query" }, { status: 400 });
  return Response.json({ participants: await listParticipants(query) }, { headers: { "Cache-Control": "no-store" } });
}
