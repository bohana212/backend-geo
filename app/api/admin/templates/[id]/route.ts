import { db, ensureSchema } from "@/lib/db";
import { requireAdmin } from "@/lib/security";
import { logActivity, getIp, getUa } from "@/lib/logger";
export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const { id } = await ctx.params;
    const body = await request.json();
    const sql = db();
    const name = body.name !== undefined ? String(body.name).trim() : null;
    const content = body.content !== undefined ? String(body.content).trim() : null;
    const parseMode = body.parse_mode ?? body.parseMode;
    const variables: string[] | null = Array.isArray(body.variables) ? body.variables.map(String) : null;

    const [template] = await sql`
      UPDATE message_templates SET
        name       = COALESCE(${name}, name),
        content    = COALESCE(${content}, content),
        parse_mode = COALESCE(${parseMode ? String(parseMode) : null}, parse_mode),
        variables  = COALESCE(${variables}, variables),
        updated_at = NOW()
      WHERE id = ${id}::uuid RETURNING *
    `;
    if (!template) return Response.json({ ok: false, error: "Template tidak ditemukan." }, { status: 404 });
    logActivity({ log_type: "admin", action: "template_updated", ip, ua, endpoint: `/api/admin/templates/${id}`, method: "PATCH", status: 200 });
    return Response.json({ ok: true, template });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal mengubah template." }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const ip = getIp(request);
  const ua = getUa(request);
  try {
    await ensureSchema();
    const { id } = await ctx.params;
    const sql = db();
    const [tpl] = await sql`DELETE FROM message_templates WHERE id = ${id}::uuid RETURNING id, name`;
    if (!tpl) return Response.json({ ok: false, error: "Template tidak ditemukan." }, { status: 404 });
    logActivity({ log_type: "admin", action: "template_deleted", ip, ua, endpoint: `/api/admin/templates/${id}`, method: "DELETE", status: 200 });
    return Response.json({ ok: true, deleted: tpl.id });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: "Gagal menghapus template." }, { status: 500 });
  }
}
