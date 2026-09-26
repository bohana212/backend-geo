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
    const url = new URL(request.url);
    const botId = url.searchParams.get("bot_id");

    const templates = botId
      ? await sql`SELECT t.*, b.name AS bot_name FROM message_templates t LEFT JOIN telegram_bots b ON b.id = t.bot_id WHERE t.bot_id = ${botId}::uuid ORDER BY t.updated_at DESC`
      : await sql`SELECT t.*, b.name AS bot_name FROM message_templates t LEFT JOIN telegram_bots b ON b.id = t.bot_id ORDER BY t.updated_at DESC`;

    return Response.json({ ok: true, templates });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil template." }, { status: 500 });
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
    const content = String(body.content ?? "").trim();
    const parseMode = String(body.parse_mode ?? body.parseMode ?? "HTML").trim();
    const botId = body.bot_id ?? body.botId ?? null;
    const variables: string[] = Array.isArray(body.variables) ? body.variables.map(String) : [];

    if (!name || !content) {
      return Response.json({ ok: false, error: "name dan content wajib diisi." }, { status: 400 });
    }

    const sql = db();
    const [template] = botId
      ? await sql`INSERT INTO message_templates (name, content, parse_mode, bot_id, variables) VALUES (${name}, ${content}, ${parseMode}, ${botId}::uuid, ${variables}) RETURNING *`
      : await sql`INSERT INTO message_templates (name, content, parse_mode, variables) VALUES (${name}, ${content}, ${parseMode}, ${variables}) RETURNING *`;

    logActivity({ log_type: "admin", action: "template_created", ip, ua, endpoint: "/api/admin/templates", method: "POST", status: 201, details: { name } });
    return Response.json({ ok: true, template }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal membuat template." }, { status: 500 });
  }
}
