import { getSession } from "./session.js";
import { findUser } from "./store.js";
import { getUserRole, isAdminUser, canManageUsers } from "./roles.mjs";

export const privateResponseHeaders = { "Cache-Control": "private, no-store" };

export async function authorizeUser({ adminOnly = false, manageUsers = false } = {}) {
  const session = await getSession();
  const account = session ? await findUser(session.email) : null;
  if (!account) {
    return {
      user: null,
      response: Response.json({ error: "unauthorized" }, {
        status: 401, headers: privateResponseHeaders,
      }),
    };
  }
  // Resolve current permissions from server storage on every request.
  // Never accept role or account identity from request parameters or the UI.
  const user = {
    email: session.email,
    name: account.name || null,
    role: getUserRole(account),
  };
  if ((adminOnly && !isAdminUser(user)) || (manageUsers && !canManageUsers(user))) {
    return {
      user: null,
      response: Response.json({ error: "forbidden" }, {
        status: 403, headers: privateResponseHeaders,
      }),
    };
  }
  return { user, response: null };
}
