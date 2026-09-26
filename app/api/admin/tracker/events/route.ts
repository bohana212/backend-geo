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
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = (page - 1) * limit;
    const trackerId = url.searchParams.get("tracker_id");
    const eventType = url.searchParams.get("event_type");

    const sql = db();
    const events = trackerId
      ? await sql`
          SELECT e.*, t.name AS tracker_name FROM tracker_events e
          LEFT JOIN tracker_configs t ON t.id = e.tracker_id
          WHERE e.tracker_id = ${trackerId}::uuid
          ORDER BY e.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `
      : eventType
        ? await sql`
            SELECT e.*, t.name AS tracker_name FROM tracker_events e
            LEFT JOIN tracker_configs t ON t.id = e.tracker_id
            WHERE e.event_type = ${eventType}
            ORDER BY e.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT e.*, t.name AS tracker_name FROM tracker_events e
            LEFT JOIN tracker_configs t ON t.id = e.tracker_id
            ORDER BY e.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;

    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM tracker_events`;
    return Response.json({
      ok: true, events,
      pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengambil tracker events." }, { status: 500 });
  }
}
