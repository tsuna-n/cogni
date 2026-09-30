import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { isStorageError, listManagedUsers } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { response } = await authorizeUser({ manageUsers: true });
    if (response) return response;
    return Response.json({ users: await listManagedUsers() }, { headers: privateResponseHeaders });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503, headers: privateResponseHeaders });
    throw error;
  }
}
