import { db, ensureSchema } from "@/lib/db";
import { decryptSecret } from "@/lib/security";
import { maskObject } from "@/lib/masker";
import { notifyViaBot } from "@/lib/notify";
import { getIp, getUa } from "@/lib/logger";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-tracker-key",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function esc(s: string) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function buildNotificationText(eventType: string, url: string | null, ip: string, ua: string, data: unknown): string {
  const dataStr = JSON.stringify(maskObject(data), null, 0);
  const eventEmoji: Record<string, string> = {
    page_view: "👁️", form_submit: "📝", click: "🖱️", js_error: "🚨", custom: "📌"
  };
  const emoji = eventEmoji[eventType] ?? "📡";

  const lines = [
    `${emoji} <b>Aktivitas Website Terdeteksi</b>`,
    "─".repeat(22),
    `<b>Event:</b> ${esc(eventType)}`,
    url ? `<b>URL:</b> ${esc(url.slice(0, 120))}` : null,
    `<b>IP:</b> ${esc(ip)}`,
    `<b>Browser:</b> ${esc((ua ?? "").slice(0, 80))}`,
    dataStr && dataStr !== "{}" ? `<b>Data:</b> <code>${esc(dataStr.slice(0, 300))}</code>` : null,
    "",
    `🕐 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function POST(request: Request) {
  const ip = getIp(request);
  const ua = getUa(request);

  try {
    await ensureSchema();
    const sql = db();

    // ── Resolve tracker key (header or query param for sendBeacon) ───────────
    const url = new URL(request.url);
    const trackerKey = request.headers.get("x-tracker-key") ?? url.searchParams.get("k") ?? "";
    if (!trackerKey) {
      return new Response(JSON.stringify({ ok: false, error: "Tracker key tidak ditemukan." }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // ── Lookup tracker config ────────────────────────────────────────────────
    const [tracker] = await sql`
      SELECT t.id, t.bot_id, t.notify_events, t.allowed_origins, t.enabled,
             b.token_encrypted, b.chat_id
      FROM tracker_configs t
      LEFT JOIN telegram_bots b ON b.id = t.bot_id AND b.enabled = true
      WHERE t.tracker_key = ${trackerKey}
      LIMIT 1
    `;

    if (!tracker) {
      return new Response(JSON.stringify({ ok: false, error: "Tracker key tidak valid." }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }
    if (!tracker.enabled) {
      return new Response(JSON.stringify({ ok: false, error: "Tracker tidak aktif." }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // ── Origin check ─────────────────────────────────────────────────────────
    const origin = request.headers.get("origin") ?? "";
    const allowed: string[] = tracker.allowed_origins ?? ["*"];
    if (!allowed.includes("*") && origin && !allowed.includes(origin)) {
      return new Response(JSON.stringify({ ok: false, error: "Origin tidak diizinkan." }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const eventType: string = String(body.event ?? body.event_type ?? "custom").trim().slice(0, 50);
    const eventUrl: string | null = body.url ? String(body.url).slice(0, 500) : null;
    const referrer: string | null = body.referrer ? String(body.referrer).slice(0, 500) : null;
    const sessionId: string | null = body.session_id ? String(body.session_id).slice(0, 100) : null;
    const rawData = body.data ?? body.fields ?? {};

    // ── Mask sensitive data ───────────────────────────────────────────────────
    const maskedData = maskObject(rawData);

    // ── Store event ───────────────────────────────────────────────────────────
    await sql`
      INSERT INTO tracker_events (tracker_id, event_type, url, referrer, ip, ua, session_id, data)
      VALUES (${tracker.id}, ${eventType}, ${eventUrl}, ${referrer}, ${ip}, ${ua}, ${sessionId}, ${JSON.stringify(maskedData)})
    `;

    // ── Telegram notification ─────────────────────────────────────────────────
    const notifyEvents: string[] = tracker.notify_events ?? [];
    if (notifyEvents.includes(eventType) && tracker.token_encrypted && tracker.chat_id) {
      const botToken = decryptSecret(tracker.token_encrypted);
      const msg = buildNotificationText(eventType, eventUrl, ip, ua, maskedData);
      notifyViaBot(botToken, tracker.chat_id, "Aktivitas Website Terdeteksi", [], "📡");
      // Send raw formatted message directly
      fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tracker.chat_id, text: msg, parse_mode: "HTML", disable_web_page_preview: true }),
        cache: "no-store",
      }).catch(() => null);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[tracker]", err);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error." }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
}
