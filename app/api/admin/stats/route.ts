import { db, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const sql = db();

    const [
      [botsRow],
      [msgRow],
      [trackerRow],
      [actRow],
      topBots,
      recentMessages,
    ] = await Promise.all([
      sql`SELECT
            COUNT(*) FILTER (WHERE enabled = true)  AS active_bots,
            COUNT(*) FILTER (WHERE enabled = false) AS inactive_bots,
            COUNT(*)                                 AS total_bots
          FROM telegram_bots`,

      sql`SELECT
            COUNT(*)                                               AS total_messages,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')   AS messages_today,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')     AS messages_week,
            COUNT(*) FILTER (WHERE status = 'failed')                          AS total_failed,
            COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') AS failed_today
          FROM message_logs`,

      sql`SELECT
            COUNT(*) FILTER (WHERE enabled = true) AS active_trackers,
            COUNT(*)                               AS total_trackers,
            (SELECT COUNT(*) FROM tracker_events WHERE created_at > NOW() - INTERVAL '24 hours') AS events_today
          FROM tracker_configs`,

      sql`SELECT COUNT(*) AS total_logs FROM activity_logs`,

      sql`SELECT b.id, b.name, b.enabled,
                 COUNT(m.id) AS messages_sent
          FROM telegram_bots b
          LEFT JOIN message_logs m ON m.bot_id = b.id AND m.status = 'sent'
          GROUP BY b.id
          ORDER BY messages_sent DESC LIMIT 5`,

      sql`SELECT m.id, m.message, m.status, m.created_at,
                 b.name AS bot_name
          FROM message_logs m
          JOIN telegram_bots b ON b.id = m.bot_id
          ORDER BY m.created_at DESC LIMIT 10`,
    ]);

    return Response.json({
      ok: true,
      stats: {
        bots: {
          total: Number(botsRow.total_bots),
          active: Number(botsRow.active_bots),
          inactive: Number(botsRow.inactive_bots),
        },
        messages: {
          total: Number(msgRow.total_messages),
          today: Number(msgRow.messages_today),
          week: Number(msgRow.messages_week),
          failed_total: Number(msgRow.total_failed),
          failed_today: Number(msgRow.failed_today),
        },
        tracker: {
          total: Number(trackerRow.total_trackers),
          active: Number(trackerRow.active_trackers),
          events_today: Number(trackerRow.events_today),
        },
        logs: {
          total: Number(actRow.total_logs),
        },
      },
      top_bots: topBots,
      recent_messages: recentMessages,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil statistik." }, { status: 500 });
  }
}
