import { db, ensureSchema } from "@/lib/db";
import { decryptSecret, hashApiKey, withCors, corsPreflight } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
export const runtime = "nodejs";

/**
 * POST /api/telegram/bulk
 * Send one message to multiple chat IDs.
 *
 * Body:
 * {
 *   "message": "Hello {{name}}!",
 *   "chatIds": ["111", "222", "333"],
 *   "parse_mode": "HTML",          // optional
 *   "vars": { "name": "World" }    // optional template vars
 * }
 *
 * OR send different messages:
 * {
 *   "messages": [
 *     { "chatId": "111", "message": "Hi Alice" },
 *     { "chatId": "222", "message": "Hi Bob"   }
 *   ]
 * }
 */
export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function renderTemplate(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const ip = getIp(request);
  const ua = getUa(request);

  try {
    const apiKey = request.headers.get("x-api-key") ?? "";
    if (!apiKey) {
      return withCors(request, Response.json({ ok: false, error: "Header x-api-key wajib diisi." }, { status: 401 }));
    }

    await ensureSchema();
    const sql = db();

    const [bot] = await sql`
      SELECT id, name, token_encrypted, chat_id, enabled, rate_limit
      FROM telegram_bots WHERE api_key_hash = ${hashApiKey(apiKey)} LIMIT 1
    `;
    if (!bot) return withCors(request, Response.json({ ok: false, error: "API key tidak valid." }, { status: 401 }));
    if (!bot.enabled) return withCors(request, Response.json({ ok: false, error: "Bot sedang dinonaktifkan." }, { status: 403 }));

    const body = await request.json();
    const parseMode: string | null = body.parse_mode ?? body.parseMode ?? null;
    const vars: Record<string, string> = body.vars ?? body.variables ?? {};

    // Build target list
    type Target = { chatId: string; message: string };
    let targets: Target[] = [];

    if (Array.isArray(body.messages)) {
      targets = body.messages.map((m: Record<string, string>) => ({
        chatId: String(m.chatId ?? m.chat_id ?? m.to ?? "").trim(),
        message: renderTemplate(String(m.message ?? m.text ?? "").trim(), vars),
      })).filter((t: Target) => t.chatId && t.message);
    } else if (body.chatIds && body.message) {
      const msg = renderTemplate(String(body.message ?? "").trim(), vars);
      const chatIds: string[] = Array.isArray(body.chatIds) ? body.chatIds : [body.chatIds];
      targets = chatIds.map((c: string) => ({ chatId: String(c).trim(), message: msg })).filter((t) => t.chatId);
    }

    if (targets.length === 0) {
      return withCors(request, Response.json({ ok: false, error: "Tidak ada target pesan yang valid." }, { status: 400 }));
    }
    if (targets.length > 50) {
      return withCors(request, Response.json({ ok: false, error: "Maksimal 50 pesan per request bulk." }, { status: 400 }));
    }

    const token = decryptSecret(bot.token_encrypted);
    const results: Array<{ chatId: string; ok: boolean; message_id?: number; error?: string }> = [];

    for (const { chatId, message } of targets) {
      const payload: Record<string, unknown> = { chat_id: chatId, text: message, disable_web_page_preview: true };
      if (parseMode) payload.parse_mode = parseMode;

      const tg = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" }
      );
      const res = await tg.json() as { ok: boolean; result?: { message_id: number }; description?: string };
      const sent = tg.ok && res.ok;

      await sql`
        INSERT INTO message_logs (bot_id, chat_id, message, parse_mode, status, tg_message_id, error, ip, ua)
        VALUES (${bot.id}, ${chatId}, ${message}, ${parseMode}, ${sent ? "sent" : "failed"},
                ${sent ? (res.result?.message_id ?? null) : null}, ${sent ? null : (res.description ?? null)}, ${ip}, ${ua})
      `.catch(() => null);

      results.push(sent
        ? { chatId, ok: true, message_id: res.result?.message_id }
        : { chatId, ok: false, error: res.description ?? "Unknown" }
      );
    }

    const sent = results.filter((r) => r.ok).length;
    logActivity({ log_type: "api", action: "bulk_send", bot_id: bot.id, ip, ua, endpoint: "/api/telegram/bulk", method: "POST", status: 200, duration_ms: Date.now() - t0, details: { total: targets.length, sent, failed: targets.length - sent } });

    return withCors(request, Response.json({
      ok: true,
      bot: { id: bot.id, name: bot.name },
      summary: { total: targets.length, sent, failed: targets.length - sent },
      results,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("[bulk]", err);
    return withCors(request, Response.json({ ok: false, error: "Internal server error." }, { status: 500 }));
  }
}
