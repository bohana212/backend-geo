import { db, ensureSchema } from "@/lib/db";
import { hashApiKey, randomApiKey, requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
import { notifyAdmin } from "@/lib/notify";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const { id } = await ctx.params;
    const apiKey = randomApiKey();
    const sql = db();
    const [bot] = await sql`
      UPDATE telegram_bots SET api_key_hash = ${hashApiKey(apiKey)}, updated_at = NOW()
      WHERE id = ${id}::uuid RETURNING id, name
    `;
    if (!bot) return Response.json({ ok: false, error: "Bot tidak ditemukan." }, { status: 404 });

    logActivity({ log_type: "admin", action: "api_key_rotated", bot_id: id, ip, ua, endpoint: `/api/admin/bots/${id}/rotate-key`, method: "POST", status: 200, details: { name: bot.name } });
    notifyAdmin("API Key Di-rotate", [
      { label: "Bot", value: bot.name },
      { label: "IP Admin", value: ip },
    ], "🔑");

    return Response.json({
      ok: true, bot,
      apiKey,
      warning: "⚠️ API key lama langsung tidak berlaku. Simpan API key baru sekarang.",
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengganti API key." }, { status: 500 });
  }
}
