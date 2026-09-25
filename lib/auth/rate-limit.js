import { getDatabase } from "../server-database.js";

const buckets = new Map();
let databaseCallsSinceCleanup = 0;

export async function rateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`INSERT INTO cogniload_rate_limits (bucket_key, count, reset_at)
      VALUES (${key}, 1, ${now + windowMs})
      ON CONFLICT (bucket_key) DO UPDATE SET
        count = CASE WHEN cogniload_rate_limits.reset_at <= ${now} THEN 1 ELSE cogniload_rate_limits.count + 1 END,
        reset_at = CASE WHEN cogniload_rate_limits.reset_at <= ${now} THEN ${now + windowMs} ELSE cogniload_rate_limits.reset_at END
      RETURNING count, reset_at`;
    const bucket = rows[0];
    databaseCallsSinceCleanup += 1;
    if (databaseCallsSinceCleanup >= 1000) {
      databaseCallsSinceCleanup = 0;
      await sql`DELETE FROM cogniload_rate_limits WHERE reset_at < ${now}`.catch((error) => {
        console.error("Cannot clean expired rate limits:", error);
      });
    }
    return bucket.count <= limit ? { ok: true } : { ok: false, retryAfter: Math.max(1, Math.ceil((Number(bucket.reset_at) - now) / 1000)) };
  }
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.reset - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clientKey(request, scope) {
  const forwarded = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") : request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
