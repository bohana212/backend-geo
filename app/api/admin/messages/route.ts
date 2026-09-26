import { db, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = (page - 1) * limit;
    const botId = url.searchParams.get("bot_id");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q");

    const sql = db();

    const messages = botId
      ? status
        ? await sql`
            SELECT m.id, m.chat_id, m.message, m.parse_mode, m.status, m.tg_message_id, m.error, m.ip, m.created_at,
                   b.name AS bot_name, b.id AS bot_id
            FROM message_logs m JOIN telegram_bots b ON b.id = m.bot_id
            WHERE m.bot_id = ${botId}::uuid AND m.status = ${status}
            ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT m.id, m.chat_id, m.message, m.parse_mode, m.status, m.tg_message_id, m.error, m.ip, m.created_at,
                   b.name AS bot_name, b.id AS bot_id
            FROM message_logs m JOIN telegram_bots b ON b.id = m.bot_id
            WHERE m.bot_id = ${botId}::uuid
            ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `
      : search
        ? await sql`
            SELECT m.id, m.chat_id, m.message, m.parse_mode, m.status, m.tg_message_id, m.error, m.ip, m.created_at,
                   b.name AS bot_name, b.id AS bot_id
            FROM message_logs m JOIN telegram_bots b ON b.id = m.bot_id
            WHERE m.message ILIKE ${'%' + search + '%'}
            ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT m.id, m.chat_id, m.message, m.parse_mode, m.status, m.tg_message_id, m.error, m.ip, m.created_at,
                   b.name AS bot_name, b.id AS bot_id
            FROM message_logs m JOIN telegram_bots b ON b.id = m.bot_id
            ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;

    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM message_logs`;

    return Response.json({
      ok: true,
      messages,
      pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil riwayat pesan." }, { status: 500 });
  }
}
