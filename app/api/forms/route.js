import { authorizeUser, privateResponseHeaders } from "@/lib/auth/authorization";
import { isStorageError } from "@/lib/auth/store";
import { readUserForms, saveUserForm, confirmScreening } from "@/lib/forms/store";
import { validateForm, validateScreening, FormValidationError } from "@/lib/forms/validation.mjs";

export const runtime = "nodejs";
export async function GET() {
  try {
    const { user, response } = await authorizeUser();
    if (response) return response;
    return Response.json({ forms: await readUserForms(user.email) }, { headers: privateResponseHeaders });
  } catch (error) {
    if (isStorageError(error)) return Response.json({ error: 'storage_unavailable' }, { status: 503 });
    throw error;
  }
}
async function write(request, confirm) {
  try {
    const { user, response } = await authorizeUser();
    if (response) return response;
    const origin = request.headers.get('origin');
    if (origin) {
      let source;
      try { source = new URL(origin); } catch { return Response.json({ error: 'forbidden' }, { status: 403 }); }
      const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || new URL(request.url).protocol.slice(0, -1);
      if (source.host !== request.headers.get('host') || source.protocol !== `${protocol}:`) return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'invalid_body' }, { status: 415 });
    const raw = await request.text();
    if (raw.length > 262144) return Response.json({ error: 'invalid_body' }, { status: 413 });
    const body = JSON.parse(raw);
    if (confirm) {
      const screening = await confirmScreening(user.email, validateScreening(body), user.participantId);
      return Response.json({ screening }, { headers: privateResponseHeaders });
    }
    if (!body || Object.keys(body).some((key) => !['key', 'value'].includes(key))) throw new FormValidationError();
    const value = validateForm(body.key, body.value);
    if (body.key === 'setup' && user.role === 'user') value.participant = user.participantId;
    await saveUserForm(user.email, body.key, value);
    return Response.json({ saved: true }, { headers: privateResponseHeaders });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof FormValidationError) return Response.json({ error: 'invalid_body' }, { status: 400 });
    if (isStorageError(error)) return Response.json({ error: 'storage_unavailable' }, { status: 503 });
    throw error;
  }
}
export const PUT = (request) => write(request, false);
export const POST = (request) => write(request, true);
