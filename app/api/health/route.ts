export async function GET() {
  return Response.json({ ok: true, service: "geotama-telegram-backend", timestamp: new Date().toISOString() });
}