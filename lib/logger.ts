import { db } from "./db";

export type LogType = "api" | "admin" | "tracker" | "system";

export interface ActivityLog {
  log_type?: LogType;
  action: string;
  bot_id?: string | null;
  ip?: string | null;
  ua?: string | null;
  endpoint: string;
  method: string;
  status?: number | null;
  duration_ms?: number | null;
  details?: Record<string, unknown>;
}

/** Write an activity log entry. Fire-and-forget — never throws. */
export function logActivity(data: ActivityLog): void {
  const sql = db();
  sql`
    INSERT INTO activity_logs
      (log_type, action, bot_id, ip, ua, endpoint, method, status, duration_ms, details)
    VALUES (
      ${data.log_type ?? "api"},
      ${data.action},
      ${data.bot_id ?? null},
      ${data.ip ?? null},
      ${data.ua ?? null},
      ${data.endpoint},
      ${data.method},
      ${data.status ?? null},
      ${data.duration_ms ?? null},
      ${JSON.stringify(data.details ?? {})}
    )
  `.catch((err) => console.error("[logger]", err));
}

/** Extract real client IP from Vercel / reverse-proxy headers. */
export function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Extract User-Agent. */
export function getUa(req: Request): string {
  return req.headers.get("user-agent") ?? "unknown";
}
