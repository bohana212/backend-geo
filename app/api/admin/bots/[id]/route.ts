import { db, ensureSchema } from "@/lib/db";
import { encryptSecret, requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
import { notifyAdmin } from "@/lib/notify";
export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const { id } = await ctx.params;
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : null;
    const botToken = body.botToken ?? body.bot_token;
    const chatId = body.chatId ?? body.chat_id;
    const description = body.description !== undefined ? String(body.description).trim() || null : undefined;
    const enabled = body.enabled !== undefined ? Boolean(body.enabled) : null;
    const rateLimit = body.rateLimit ?? body.rate_limit;

    const sql = db();
    const [bot] = await sql`
      UPDATE telegram_bots SET
        name             = COALESCE(${name}, name),
        description      = COALESCE(${description ?? null}, description),
        token_encrypted  = COALESCE(${botToken ? encryptSecret(String(botToken)) : null}, token_encrypted),
        chat_id          = COALESCE(${chatId ? String(chatId) : null}, chat_id),
        enabled          = COALESCE(${enabled}, enabled),
        rate_limit       = COALESCE(${rateLimit != null ? Number(rateLimit) : null}, rate_limit),
        updated_at       = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, name, description, chat_id, enabled, rate_limit, created_at, updated_at
    `;
    if (!bot) return Response.json({ ok: false, error: "Bot tidak ditemukan." }, { status: 404 });

    logActivity({ log_type: "admin", action: "bot_updated", bot_id: id, ip, ua, endpoint: `/api/admin/bots/${id}`, method: "PATCH", status: 200, details: { changed: Object.keys(body) } });
    if (body.enabled !== undefined) {
      notifyAdmin(bot.enabled ? "Bot Diaktifkan" : "Bot Dinonaktifkan", [
        { label: "Bot", value: bot.name },
        { label: "IP Admin", value: ip },
      ], bot.enabled ? "✅" : "⛔");
    }

    return Response.json({ ok: true, bot });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengubah bot." }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const { id } = await ctx.params;
    const sql = db();
    const [bot] = await sql`DELETE FROM telegram_bots WHERE id = ${id}::uuid RETURNING id, name`;
    if (!bot) return Response.json({ ok: false, error: "Bot tidak ditemukan." }, { status: 404 });

    logActivity({ log_type: "admin", action: "bot_deleted", ip, ua, endpoint: `/api/admin/bots/${id}`, method: "DELETE", status: 200, details: { name: bot.name } });
    notifyAdmin("Bot Dihapus", [
      { label: "Bot", value: bot.name },
      { label: "ID", value: bot.id },
      { label: "IP Admin", value: ip },
    ], "🗑️");

    return Response.json({ ok: true, deleted: bot.id });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal menghapus bot." }, { status: 500 });
  }
}
