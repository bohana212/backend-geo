-- Run this manually once, or via /api/admin/bots/init

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Core: Bot Registry ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_bots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  token_encrypted TEXT      NOT NULL,
  chat_id       TEXT        NOT NULL,
  api_key_hash  TEXT        NOT NULL UNIQUE,
  enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  rate_limit    INTEGER     NOT NULL DEFAULT 60,   -- max messages per minute
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Message History ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          UUID        NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  chat_id         TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  parse_mode      TEXT,
  status          TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  tg_message_id   INTEGER,
  error           TEXT,
  ip              TEXT,
  ua              TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msg_created  ON message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_bot      ON message_logs(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_status   ON message_logs(status, created_at DESC);

-- ─── Message Templates ────────────────────────────────────────────────────────
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
);

-- ─── Activity / Audit Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type    TEXT        NOT NULL DEFAULT 'api',   -- 'api' | 'admin' | 'tracker' | 'system'
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
);
CREATE INDEX IF NOT EXISTS idx_act_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_act_type    ON activity_logs(log_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_act_bot     ON activity_logs(bot_id, created_at DESC);

-- ─── Frontend Activity Tracker ────────────────────────────────────────────────
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
);

CREATE TABLE IF NOT EXISTS tracker_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id  UUID        REFERENCES tracker_configs(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,   -- 'page_view' | 'click' | 'form_submit' | 'js_error' | 'custom'
  url         TEXT,
  referrer    TEXT,
  ip          TEXT,
  ua          TEXT,
  session_id  TEXT,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trk_created ON tracker_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trk_type    ON tracker_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trk_cfg     ON tracker_events(tracker_id, created_at DESC);
