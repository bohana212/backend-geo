import { ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
import { notifyAdmin } from "@/lib/notify";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    logActivity({ log_type: "admin", action: "schema_init", ip, ua, endpoint: "/api/admin/bots/init", method: "POST", status: 200 });
    notifyAdmin("Database Diinisialisasi", [
      { label: "IP", value: ip },
      { label: "Status", value: "Berhasil" },
    ], "🗄️");
    return Response.json({ ok: true, message: "Database siap digunakan." });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal menyiapkan database." }, { status: 500 });
  }
}
