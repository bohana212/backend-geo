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
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = (page - 1) * limit;
    const logType = url.searchParams.get("type");
    const botId = url.searchParams.get("bot_id");

    const sql = db();
    const logs = logType
      ? await sql`
          SELECT l.*, b.name AS bot_name FROM activity_logs l
          LEFT JOIN telegram_bots b ON b.id = l.bot_id
          WHERE l.log_type = ${logType}
          ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `
      : botId
        ? await sql`
            SELECT l.*, b.name AS bot_name FROM activity_logs l
            LEFT JOIN telegram_bots b ON b.id = l.bot_id
            WHERE l.bot_id = ${botId}::uuid
            ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT l.*, b.name AS bot_name FROM activity_logs l
            LEFT JOIN telegram_bots b ON b.id = l.bot_id
            ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;

    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM activity_logs`;
    return Response.json({
      ok: true, logs,
      pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil log." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const olderThanDays = Number(url.searchParams.get("older_than_days") ?? 30);
    const sql = db();
    const [{ count }] = await sql`
      WITH deleted AS (
        DELETE FROM activity_logs
        WHERE created_at < NOW() - (${olderThanDays} || ' days')::INTERVAL
        RETURNING id
      ) SELECT COUNT(*) AS count FROM deleted
    `;
    return Response.json({ ok: true, deleted: Number(count), older_than_days: olderThanDays });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal membersihkan log." }, { status: 500 });
  }
}
