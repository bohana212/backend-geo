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

    const [bot] = await sql`
      SELECT id, name, token_encrypted, chat_id FROM telegram_bots WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!bot) return Response.json({ ok: false, error: "Bot tidak ditemukan." }, { status: 404 });

    const token = decryptSecret(bot.token_encrypted);

    // 1. Verify token via getMe
    const meRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, { cache: "no-store" });
    const me = await meRes.json() as { ok: boolean; result?: { username: string; first_name: string }; description?: string };

    if (!me.ok) {
      logActivity({ log_type: "admin", action: "bot_test_fail", bot_id: id, ip, ua, endpoint: `/api/admin/bots/${id}/test`, method: "POST", status: 400, details: { telegram_error: me.description } });
      return Response.json({ ok: false, error: "Token bot tidak valid.", telegram: me.description });
    }

    // 2. Send test message to the configured chat
    const body = await request.json().catch(() => ({})) as Record<string, string>;
    const testMessage = `✅ <b>Test berhasil!</b>\n\nBot <b>${me.result?.first_name}</b> (@${me.result?.username}) terhubung ke Geotama Backend.\n🕐 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
    const targetChatId = String(body.chatId ?? body.chat_id ?? "").trim() || bot.chat_id;

    const sendRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChatId, text: testMessage, parse_mode: "HTML" }),
      cache: "no-store",
    });
    const sendResult = await sendRes.json() as { ok: boolean; description?: string };

    logActivity({ log_type: "admin", action: "bot_test_success", bot_id: id, ip, ua, endpoint: `/api/admin/bots/${id}/test`, method: "POST", status: 200, details: { telegram_username: me.result?.username } });

    return Response.json({
      ok: true,
      bot: { id: bot.id, name: bot.name },
      telegram_bot: { username: me.result?.username, first_name: me.result?.first_name },
      test_message_sent: sendResult.ok,
      test_message_error: sendResult.ok ? null : sendResult.description,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal melakukan test bot." }, { status: 500 });
  }
}
