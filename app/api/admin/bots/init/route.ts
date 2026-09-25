import { ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    return Response.json({ ok: true, message: "Database siap." });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: "Gagal menyiapkan database." }, { status: 500 });
  }
}