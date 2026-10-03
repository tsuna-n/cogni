import { neon } from "@neondatabase/serverless";

let activeUrl = null;
let activeSql = null;
let schemaPromise = null;

export async function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL) {
      const error = new Error("DATABASE_URL is required on Vercel for persistent storage");
      error.code = "STORAGE_UNAVAILABLE";
      throw error;
    }
    return null;
  }
  if (url !== activeUrl) {
    activeUrl = url;
    activeSql = neon(url);
    schemaPromise = null;
  }
  if (!schemaPromise) {
    const sql = activeSql;
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS cogniload_users (
        email TEXT PRIMARY KEY,
        name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'researcher', 'admin')),
        created_at TEXT,
        login_count INTEGER NOT NULL DEFAULT 0,
        last_login_at TEXT
      )`;
      await sql`ALTER TABLE cogniload_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;
      // Upgrade the original two-role schema without changing assigned roles.
      await sql`ALTER TABLE cogniload_users
        DROP CONSTRAINT IF EXISTS cogniload_users_role_check,
        ADD CONSTRAINT cogniload_users_role_check CHECK (role IN ('user', 'researcher', 'admin')),
        ALTER COLUMN role SET DEFAULT 'user'`;
      await sql`ALTER TABLE cogniload_users
        ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS profile_updated_at TEXT,
        ADD COLUMN IF NOT EXISTS profile_updated_by TEXT`;
      // Serialize this upgrade across server instances. Existing accounts receive
      // numbers in signup order; subsequent inserts use PostgreSQL's sequence.
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(72403621)`,
        sql`CREATE SEQUENCE IF NOT EXISTS cogniload_participant_number_seq`,
        sql`ALTER TABLE cogniload_users ADD COLUMN IF NOT EXISTS participant_number BIGINT`,
        sql`WITH numbered AS MATERIALIZED (
          SELECT email, nextval('cogniload_participant_number_seq') AS number
          FROM (SELECT email FROM cogniload_users WHERE participant_number IS NULL ORDER BY created_at NULLS LAST, email) accounts
        ) UPDATE cogniload_users SET participant_number = numbered.number FROM numbered WHERE cogniload_users.email = numbered.email`,
        sql`ALTER TABLE cogniload_users ALTER COLUMN participant_number SET DEFAULT nextval('cogniload_participant_number_seq'), ALTER COLUMN participant_number SET NOT NULL`,
        sql`CREATE UNIQUE INDEX IF NOT EXISTS cogniload_participant_number_idx ON cogniload_users (participant_number)`,
      ]);
      await sql`CREATE TABLE IF NOT EXISTS cogniload_user_forms (
        email TEXT NOT NULL REFERENCES cogniload_users(email),
        form_key TEXT NOT NULL,
        value JSONB NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (email, form_key)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS cogniload_research_records (
        record_id TEXT PRIMARY KEY,
        participant_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        summary JSONB NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS cogniload_research_participant_idx ON cogniload_research_records (participant_id)`;
      await sql`CREATE TABLE IF NOT EXISTS cogniload_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS cogniload_rate_limits (
        bucket_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at BIGINT NOT NULL
      )`;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
  return activeSql;
}
