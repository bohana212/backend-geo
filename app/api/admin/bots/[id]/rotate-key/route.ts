import { db, ensureSchema } from "@/lib/db";
import { hashApiKey, randomApiKey, requireAdmin } from "@/lib/security";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{id:string}> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const { id } = await context.params;
    const apiKey = randomApiKey();
    const sql = db();
    const rows = await sql`
      UPDATE telegram_bots SET api_key_hash=${hashApiKey(apiKey)},updated_at=NOW()
      WHERE id=${id}::uuid RETURNING id,name
    `;
    if (!rows.length) return Response.json({ok:false,error:"Bot tidak ditemukan."},{status:404});
    return Response.json({
      ok:true,bot:rows[0],apiKey,
      warning:"API key lama langsung tidak berlaku. Simpan API key baru."
    });
  } catch (error) {
    console.error(error);
    return Response.json({ok:false,error:"Gagal mengganti API key."},{status:500});
  }
}