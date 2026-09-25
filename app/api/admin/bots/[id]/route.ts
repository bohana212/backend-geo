import { db, ensureSchema } from "@/lib/db";
import { encryptSecret, requireAdmin } from "@/lib/security";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{id:string}> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const { id } = await context.params;
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : null;
    const botToken = body.botToken !== undefined ? String(body.botToken).trim() : null;
    const chatId = body.chatId !== undefined ? String(body.chatId).trim() : null;
    const enabled = body.enabled !== undefined ? Boolean(body.enabled) : null;
    const sql = db();

    const rows = await sql`
      UPDATE telegram_bots
      SET name=COALESCE(${name},name),
          token_encrypted=COALESCE(${botToken ? encryptSecret(botToken) : null},token_encrypted),
          chat_id=COALESCE(${chatId},chat_id),
          enabled=COALESCE(${enabled},enabled),
          updated_at=NOW()
      WHERE id=${id}::uuid
      RETURNING id,name,chat_id,enabled,created_at,updated_at
    `;
    if (!rows.length) return Response.json({ ok:false,error:"Bot tidak ditemukan." }, {status:404});
    return Response.json({ ok:true, bot:rows[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ ok:false,error:"Gagal mengubah bot." }, {status:500});
  }
}

export async function DELETE(request: Request, context: { params: Promise<{id:string}> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const { id } = await context.params;
    const sql = db();
    const rows = await sql`DELETE FROM telegram_bots WHERE id=${id}::uuid RETURNING id`;
    if (!rows.length) return Response.json({ok:false,error:"Bot tidak ditemukan."},{status:404});
    return Response.json({ok:true,deleted:id});
  } catch (error) {
    console.error(error);
    return Response.json({ok:false,error:"Gagal menghapus bot."},{status:500});
  }
}