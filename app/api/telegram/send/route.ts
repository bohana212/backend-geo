import { db, ensureSchema } from "@/lib/db";
import { decryptSecret, hashApiKey, withCors } from "@/lib/security";
export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return withCors(request, new Response(null,{status:204}));
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key") ?? "";
    if (!apiKey) return withCors(request, Response.json({ok:false,error:"x-api-key wajib diisi."},{status:401}));

    await ensureSchema();
    const body = await request.json();
    const message = String(body.message ?? "");
    const requestedChatId = body.chatId !== undefined ? String(body.chatId).trim() : "";
    if (!message.trim()) return withCors(request, Response.json({ok:false,error:"message wajib diisi."},{status:400}));

    const sql = db();
    const rows = await sql`
      SELECT id,name,token_encrypted,chat_id,enabled
      FROM telegram_bots WHERE api_key_hash=${hashApiKey(apiKey)} LIMIT 1
    `;
    if (!rows.length) return withCors(request, Response.json({ok:false,error:"API key tidak valid."},{status:401}));

    const bot = rows[0];
    if (!bot.enabled) return withCors(request, Response.json({ok:false,error:"Bot sedang dinonaktifkan."},{status:403}));

    const token = decryptSecret(bot.token_encrypted);
    const chatId = requestedChatId || bot.chat_id;

    const tg = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({chat_id:chatId,text:message,disable_web_page_preview:true}),
      cache:"no-store"
    });
    const result = await tg.json();

    if (!tg.ok || !result.ok) {
      console.error("Telegram API:", result);
      return withCors(request, Response.json(
        {ok:false,error:"Telegram menolak request.",telegram:result.description ?? null},{status:502}
      ));
    }

    return withCors(request, Response.json({
      ok:true,bot:{id:bot.id,name:bot.name},message_id:result.result?.message_id ?? null
    }));
  } catch (error) {
    console.error(error);
    return withCors(request, Response.json({ok:false,error:"Internal server error."},{status:500}));
  }
}