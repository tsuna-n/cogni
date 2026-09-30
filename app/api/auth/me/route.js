import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { isStorageError } from "@/lib/auth/store";

export async function GET() {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw error;
  }
}

async function getCurrentUser() {
  const { user, response } = await authorizeUser();
  if (response) return Response.json({ user: null }, { status: response.status, headers: privateResponseHeaders });
  return Response.json({ user }, { headers: privateResponseHeaders });
}
