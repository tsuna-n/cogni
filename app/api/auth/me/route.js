import { getSession } from "@/lib/auth/session";
import { findUser, isAdminEmail } from "@/lib/auth/store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }
  const user = await findUser(session.email);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: { email: session.email, name: user.name || null, role: isAdminEmail(session.email) ? "admin" : "researcher" } });
}
