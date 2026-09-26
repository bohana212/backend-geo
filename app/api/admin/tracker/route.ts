import { db, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const sql = db();
    const trackers = await sql`
      SELECT t.*, b.name AS bot_name,
             (SELECT COUNT(*) FROM tracker_events e WHERE e.tracker_id = t.id) AS total_events,
             (SELECT COUNT(*) FROM tracker_events e WHERE e.tracker_id = t.id AND e.created_at > NOW() - INTERVAL '24 hours') AS events_today
      FROM tracker_configs t
      LEFT JOIN telegram_bots b ON b.id = t.bot_id
      ORDER BY t.created_at DESC
    `;
    return Response.json({ ok: true, trackers });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil tracker." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) return Response.json({ ok: false, error: "name wajib diisi." }, { status: 400 });

    const botId = body.bot_id ?? body.botId ?? null;
    const notifyEvents: string[] = Array.isArray(body.notify_events)
      ? body.notify_events.map(String)
      : ["form_submit", "js_error"];
    const allowedOrigins: string[] = Array.isArray(body.allowed_origins)
      ? body.allowed_origins.map(String)
      : ["*"];

    const sql = db();
    const [tracker] = botId
      ? await sql`INSERT INTO tracker_configs (name, bot_id, notify_events, allowed_origins) VALUES (${name}, ${botId}::uuid, ${notifyEvents}, ${allowedOrigins}) RETURNING *`
      : await sql`INSERT INTO tracker_configs (name, notify_events, allowed_origins) VALUES (${name}, ${notifyEvents}, ${allowedOrigins}) RETURNING *`;

    logActivity({ log_type: "admin", action: "tracker_created", ip, ua, endpoint: "/api/admin/tracker", method: "POST", status: 201, details: { name } });
    return Response.json({ ok: true, tracker }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal membuat tracker." }, { status: 500 });
  }
}
