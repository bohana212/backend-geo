import crypto from "node:crypto";

function encryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY harus 64 karakter hex.");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encryptedB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encryptedB64) throw new Error("Encrypted secret invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function randomApiKey() {
  return "gt_" + crypto.randomBytes(32).toString("base64url");
}

export function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function requireAdmin(request: Request): Response | null {
  const expected = process.env.MASTER_API_KEY ?? "";
  const supplied = request.headers.get("x-admin-key") ?? "";
  if (!expected || !supplied || !safeEqual(supplied, expected)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin") ?? "";
  const allowed = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map(x => x.trim()).filter(Boolean);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin",
    allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : allowed[0] ?? ""));
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-admin-key");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}