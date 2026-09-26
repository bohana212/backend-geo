import { db, ensureSchema } from "@/lib/db";
import { decryptSecret, requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const { id } = await ctx.params;
    const sql = db();

    const [msg] = await sql`
      SELECT m.*, b.token_encrypted, b.enabled
      FROM message_logs m
      JOIN telegram_bots b ON b.id = m.bot_id
      WHERE m.id = ${id}::uuid LIMIT 1
    `;
    if (!msg) return Response.json({ ok: false, error: "Pesan tidak ditemukan." }, { status: 404 });
    if (!msg.enabled) return Response.json({ ok: false, error: "Bot sedang dinonaktifkan." }, { status: 403 });

    const token = decryptSecret(msg.token_encrypted);
    const payload: Record<string, unknown> = { chat_id: msg.chat_id, text: msg.message, disable_web_page_preview: true };
    if (msg.parse_mode) payload.parse_mode = msg.parse_mode;

    const tg = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
    });
    const result = await tg.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    if (!result.ok) {
      return Response.json({ ok: false, error: "Telegram menolak resend.", telegram: result.description }, { status: 502 });
    }

    // Insert new log entry for the resend
    const [newLog] = await sql`
      INSERT INTO message_logs (bot_id, chat_id, message, parse_mode, status, tg_message_id, ip, ua)
      VALUES (${msg.bot_id}, ${msg.chat_id}, ${msg.message}, ${msg.parse_mode}, 'sent', ${result.result?.message_id ?? null}, ${ip}, ${ua})
      RETURNING id
    `;
    logActivity({ log_type: "admin", action: "message_resent", bot_id: msg.bot_id, ip, ua, endpoint: `/api/admin/messages/${id}/resend`, method: "POST", status: 200 });

    return Response.json({ ok: true, new_log_id: newLog.id, message_id: result.result?.message_id });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal resend pesan." }, { status: 500 });
  }
}
