import { db, ensureSchema } from "@/lib/db";
import { encryptSecret, hashApiKey, randomApiKey, requireAdmin } from "@/lib/security";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const sql = db();
    const bots = await sql`SELECT id,name,chat_id,enabled,created_at,updated_at FROM telegram_bots ORDER BY created_at DESC`;
    return Response.json({ ok: true, bots });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Gagal mengambil data bot." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const botToken = String(body.botToken ?? "").trim();
    const chatId = String(body.chatId ?? "").trim();

    if (!name || !botToken || !chatId) {
      return Response.json({ ok: false, error: "name, botToken, dan chatId wajib diisi." }, { status: 400 });
    }

    const apiKey = randomApiKey();
    const sql = db();
    const rows = await sql`
      INSERT INTO telegram_bots (name,token_encrypted,chat_id,api_key_hash)
      VALUES (${name},${encryptSecret(botToken)},${chatId},${hashApiKey(apiKey)})
      RETURNING id,name,chat_id,enabled,created_at,updated_at
    `;

    return Response.json({
      ok: true,
      bot: rows[0],
      apiKey,
      warning: "Simpan apiKey ini sekarang; tidak ditampilkan lagi pada list."
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Gagal membuat bot." }, { status: 500 });
  }
}