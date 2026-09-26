import { db, ensureSchema } from "@/lib/db";
import { encryptSecret, hashApiKey, randomApiKey, requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
import { notifyAdmin } from "@/lib/notify";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const sql = db();
    const bots = await sql`
      SELECT b.id, b.name, b.description, b.chat_id, b.enabled, b.rate_limit,
             b.created_at, b.updated_at,
             (SELECT COUNT(*) FROM message_logs m WHERE m.bot_id = b.id) AS total_messages,
             (SELECT COUNT(*) FROM message_logs m WHERE m.bot_id = b.id AND m.status = 'sent'
              AND m.created_at > NOW() - INTERVAL '24 hours') AS messages_today
      FROM telegram_bots b
      ORDER BY b.created_at DESC
    `;
    return Response.json({ ok: true, bots });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil data bot." }, { status: 500 });
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
    const botToken = String(body.botToken ?? body.bot_token ?? "").trim();
    const chatId = String(body.chatId ?? body.chat_id ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const rateLimit = Number(body.rateLimit ?? body.rate_limit ?? 60);

    if (!name || !botToken || !chatId) {
      return Response.json({ ok: false, error: "name, botToken, dan chatId wajib diisi." }, { status: 400 });
    }

    const apiKey = randomApiKey();
    const sql = db();
    const [bot] = await sql`
      INSERT INTO telegram_bots (name, description, token_encrypted, chat_id, api_key_hash, rate_limit)
      VALUES (${name}, ${description}, ${encryptSecret(botToken)}, ${chatId}, ${hashApiKey(apiKey)}, ${rateLimit})
      RETURNING id, name, description, chat_id, enabled, rate_limit, created_at, updated_at
    `;

    logActivity({ log_type: "admin", action: "bot_created", bot_id: bot.id, ip, ua, endpoint: "/api/admin/bots", method: "POST", status: 201, details: { name, chat_id: chatId } });
    notifyAdmin("Bot Baru Ditambahkan", [
      { label: "Nama", value: name },
      { label: "Chat ID", value: chatId },
      { label: "IP Admin", value: ip },
    ], "🤖");

    return Response.json({
      ok: true, bot,
      apiKey,
      warning: "⚠️ Simpan apiKey ini sekarang — tidak akan ditampilkan lagi.",
    }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal membuat bot." }, { status: 500 });
  }
}
