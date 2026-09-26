import { neon } from "@neondatabase/serverless";

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diset.");
  return neon(url);
}

// In-memory flag per serverless instance to avoid repeated DDL on warm invocations
let _ready = false;

export async function ensureSchema() {
  if (_ready) return;
  const sql = db();

  // ── Core bots table ──────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS telegram_bots (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT        NOT NULL,
      description     TEXT,
      token_encrypted TEXT        NOT NULL,
      chat_id         TEXT        NOT NULL,
      api_key_hash    TEXT        NOT NULL UNIQUE,
      enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
      rate_limit      INTEGER     NOT NULL DEFAULT 60,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Migrations: add new columns to existing installations ────────────────
  for (const q of [
    `ALTER TABLE telegram_bots ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE telegram_bots ADD COLUMN IF NOT EXISTS rate_limit INTEGER NOT NULL DEFAULT 60`,
  ]) {
    await sql.unsafe(q).catch(() => null);
  }

  // ── Message history ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS message_logs (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id        UUID        NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
      chat_id       TEXT        NOT NULL,
      message       TEXT        NOT NULL,
      parse_mode    TEXT,
      status        TEXT        NOT NULL DEFAULT 'sent',
      tg_message_id INTEGER,
      error         TEXT,
      ip            TEXT,
      ua            TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Message templates ─────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS message_templates (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id      UUID        REFERENCES telegram_bots(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      content     TEXT        NOT NULL,
      parse_mode  TEXT        NOT NULL DEFAULT 'HTML',
      variables   TEXT[]      NOT NULL DEFAULT '{}',
      usage_count INTEGER     NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Activity / audit logs ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      log_type    TEXT        NOT NULL DEFAULT 'api',
      action      TEXT        NOT NULL,
      bot_id      UUID        REFERENCES telegram_bots(id) ON DELETE SET NULL,
      ip          TEXT,
      ua          TEXT,
      endpoint    TEXT        NOT NULL,
      method      TEXT        NOT NULL,
      status      INTEGER,
      duration_ms INTEGER,
      details     JSONB       NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Frontend tracker ──────────────────────────────────────────────────────
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.catch(() => null);

  await sql`
    CREATE TABLE IF NOT EXISTS tracker_configs (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT        NOT NULL,
      tracker_key     TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
      bot_id          UUID        REFERENCES telegram_bots(id) ON DELETE SET NULL,
      notify_events   TEXT[]      NOT NULL DEFAULT ARRAY['form_submit','js_error'],
      allowed_origins TEXT[]      NOT NULL DEFAULT ARRAY['*'],
      enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tracker_events (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tracker_id  UUID        REFERENCES tracker_configs(id) ON DELETE SET NULL,
      event_type  TEXT        NOT NULL,
      url         TEXT,
      referrer    TEXT,
      ip          TEXT,
      ua          TEXT,
      session_id  TEXT,
      data        JSONB       NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Indexes (idempotent) ──────────────────────────────────────────────────
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_msg_created  ON message_logs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_msg_bot      ON message_logs(bot_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_msg_status   ON message_logs(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_act_created  ON activity_logs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_act_type     ON activity_logs(log_type, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_act_bot      ON activity_logs(bot_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_trk_created  ON tracker_events(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_trk_type     ON tracker_events(event_type, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_trk_cfg      ON tracker_events(tracker_id, created_at DESC)`,
  ];
  await Promise.all(indexes.map(q => sql.unsafe(q).catch(() => null)));

  _ready = true;
}
