import { registrationEnabled } from "@/lib/server-config";
import { getEffectiveStudyConfig } from "@/lib/research/study-settings-store";
import { isStorageError } from "@/lib/auth/store";
import { assertSessionSecretConfigured } from "@/lib/auth/session";

export async function GET() {
  try {
    assertSessionSecretConfigured();
    const { study } = await getEffectiveStudyConfig();
    return Response.json({ registrationEnabled: registrationEnabled(), study }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Cannot load server configuration:", error);
    const storageError = isStorageError(error);
    return Response.json({ error: storageError ? "storage_unavailable" : "invalid_server_config" }, { status: storageError ? 503 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
