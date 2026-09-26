import { db, ensureSchema } from "@/lib/db";
import { decryptSecret, hashApiKey, withCors, corsPreflight } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
import { notifyAdmin } from "@/lib/notify";
export const runtime = "nodejs";

// ─── Template variable substitution ──────────────────────────────────────────
function renderTemplate(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const ip = getIp(request);
  const ua = getUa(request);

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const apiKey = request.headers.get("x-api-key") ?? "";
    if (!apiKey) {
      return withCors(request, Response.json(
        { ok: false, error: "Header x-api-key wajib diisi." }, { status: 401 }
      ));
    }

    await ensureSchema();
    const sql = db();

    // ── Flexible body parsing ────────────────────────────────────────────────
    const body = await request.json();

    // Accept: message | text | msg
    const rawMessage: string = String(body.message ?? body.text ?? body.msg ?? "").trim();
    // Accept: chatId | chat_id | to | recipient
    const overrideChatId: string = String(body.chatId ?? body.chat_id ?? body.to ?? body.recipient ?? "").trim();
    // Accept: parse_mode | parseMode | mode
    const parseMode: string | null = body.parse_mode ?? body.parseMode ?? body.mode ?? null;
    // Template support
    const templateId: string = String(body.template_id ?? body.templateId ?? "").trim();
    const templateName: string = String(body.template ?? body.template_name ?? "").trim();
    const vars: Record<string, string> = body.vars ?? body.variables ?? {};

    // ── Lookup bot ───────────────────────────────────────────────────────────
    const [bot] = await sql`
      SELECT id, name, token_encrypted, chat_id, enabled, rate_limit
      FROM telegram_bots WHERE api_key_hash = ${hashApiKey(apiKey)} LIMIT 1
    `;

    if (!bot) {
      logActivity({ log_type: "api", action: "send_fail_auth", ip, ua, endpoint: "/api/telegram/send", method: "POST", status: 401 });
      return withCors(request, Response.json({ ok: false, error: "API key tidak valid." }, { status: 401 }));
    }
    if (!bot.enabled) {
      return withCors(request, Response.json({ ok: false, error: "Bot sedang dinonaktifkan." }, { status: 403 }));
    }

    // ── Rate limiting (count messages in last 60 s) ───────────────────────────
    const [{ count: recentCount }] = await sql`
      SELECT COUNT(*) AS count FROM message_logs
      WHERE bot_id = ${bot.id} AND status = 'sent'
        AND created_at > NOW() - INTERVAL '60 seconds'
    `;
    if (Number(recentCount) >= Number(bot.rate_limit)) {
      return withCors(request, Response.json(
        { ok: false, error: `Rate limit: maks ${bot.rate_limit} pesan/menit.`, retry_after: 60 },
        { status: 429, headers: { "Retry-After": "60" } }
      ));
    }

    // ── Resolve message (template or raw) ────────────────────────────────────
    let finalMessage = rawMessage;
    let usedTemplateId: string | null = null;

    if (templateId || templateName) {
      const [tpl] = templateId
        ? await sql`SELECT id, content FROM message_templates WHERE id = ${templateId}::uuid LIMIT 1`
        : await sql`SELECT id, content FROM message_templates WHERE name ILIKE ${templateName} LIMIT 1`;

      if (!tpl) {
        return withCors(request, Response.json({ ok: false, error: "Template tidak ditemukan." }, { status: 404 }));
      }
      finalMessage = renderTemplate(tpl.content, vars);
      usedTemplateId = tpl.id;
      // Increment usage counter (fire-and-forget)
      sql`UPDATE message_templates SET usage_count = usage_count + 1 WHERE id = ${tpl.id}`.catch(() => null);
    }

    if (!finalMessage) {
      return withCors(request, Response.json({ ok: false, error: "message / template wajib diisi." }, { status: 400 }));
    }

    // ── Send to Telegram ─────────────────────────────────────────────────────
    const token = decryptSecret(bot.token_encrypted);
    const chatId = overrideChatId || bot.chat_id;

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: finalMessage,
      disable_web_page_preview: true,
    };
    if (parseMode) payload.parse_mode = parseMode;

    const tg = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" }
    );
    const result = await tg.json() as { ok: boolean; result?: { message_id: number }; description?: string };

    const duration = Date.now() - t0;

    if (!tg.ok || !result.ok) {
      // Log failure
      await sql`
        INSERT INTO message_logs (bot_id, chat_id, message, parse_mode, status, error, ip, ua)
        VALUES (${bot.id}, ${chatId}, ${finalMessage}, ${parseMode}, 'failed', ${result.description ?? 'unknown'}, ${ip}, ${ua})
      `.catch(() => null);
      logActivity({ log_type: "api", action: "send_fail_telegram", bot_id: bot.id, ip, ua, endpoint: "/api/telegram/send", method: "POST", status: 502, duration_ms: duration, details: { telegram_error: result.description } });
      return withCors(request, Response.json({ ok: false, error: "Telegram menolak request.", telegram: result.description ?? null }, { status: 502 }));
    }

    const tgMsgId = result.result?.message_id ?? null;

    // Log success
    const [log] = await sql`
      INSERT INTO message_logs (bot_id, chat_id, message, parse_mode, status, tg_message_id, ip, ua)
      VALUES (${bot.id}, ${chatId}, ${finalMessage}, ${parseMode}, 'sent', ${tgMsgId}, ${ip}, ${ua})
      RETURNING id
    `;
    logActivity({ log_type: "api", action: "send_success", bot_id: bot.id, ip, ua, endpoint: "/api/telegram/send", method: "POST", status: 200, duration_ms: duration, details: { chat_id: chatId, message_length: finalMessage.length } });

    return withCors(request, Response.json({
      ok: true,
      bot: { id: bot.id, name: bot.name },
      message_id: tgMsgId,
      log_id: log.id,
      template_used: usedTemplateId,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.error("[send]", err);
    logActivity({ log_type: "api", action: "send_error", ip, ua, endpoint: "/api/telegram/send", method: "POST", status: 500, duration_ms: Date.now() - t0 });
    return withCors(request, Response.json({ ok: false, error: "Internal server error." }, { status: 500 }));
  }
}
