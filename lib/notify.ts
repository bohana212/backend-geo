function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wib(): string {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) + " WIB";
}

async function _send(token: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[notify] send failed:", err);
  }
}

export type NotifyItem = { label: string; value: string };

/**
 * Send admin notification to the global NOTIFY_BOT_TOKEN / NOTIFY_CHAT_ID.
 * Fire-and-forget — never throws.
 */
export function notifyAdmin(
  title: string,
  items: NotifyItem[],
  emoji = "🔔"
): void {
  const token = process.env.NOTIFY_BOT_TOKEN;
  const chatId = process.env.NOTIFY_CHAT_ID;
  if (!token || !chatId) return;

  const lines = [
    `${emoji} <b>${esc(title)}</b>`,
    "─".repeat(22),
    ...items.map(({ label, value }) => `<b>${esc(label)}:</b> ${esc(value)}`),
    "",
    `🕐 ${wib()}`,
  ];
  _send(token, chatId, lines.join("\n")).catch(() => null);
}

/**
 * Send a notification via a specific bot token (used for tracker events
 * forwarded to the assigned bot's chat).
 * Fire-and-forget — never throws.
 */
export function notifyViaBot(
  botToken: string,
  chatId: string,
  title: string,
  items: NotifyItem[],
  emoji = "📡"
): void {
  const lines = [
    `${emoji} <b>${esc(title)}</b>`,
    "─".repeat(22),
    ...items.map(({ label, value }) => `<b>${esc(label)}:</b> ${esc(value)}`),
    "",
    `🕐 ${wib()}`,
  ];
  _send(botToken, chatId, lines.join("\n")).catch(() => null);
}
