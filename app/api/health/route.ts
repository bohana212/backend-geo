import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbMs = 0;

  try {
    const sql = db();
    await sql`SELECT 1`;
    dbOk = true;
    dbMs = Date.now() - start;
  } catch {
    dbMs = Date.now() - start;
  }

  return Response.json({
    ok: true,
    service: "geotama-telegram-backend",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime_check: "ok",
    database: { ok: dbOk, latency_ms: dbMs },
  }, {
    status: dbOk ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
