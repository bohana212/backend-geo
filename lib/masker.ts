/**
 * Masks sensitive values in request data before storing / forwarding to Telegram.
 * Fields whose keys match any SENSITIVE_PATTERNS substring get their values replaced with "***".
 */

const SENSITIVE_PATTERNS = [
  "password", "passwd", "pwd", "pass",
  "token", "secret", "apikey", "api_key",
  "privatekey", "private_key", "accesskey",
  "credit_card", "cardnumber", "card_number",
  "cvv", "cvc", "ccv",
  "pin", "ssn", "otp",
  "auth", "authorization", "bearer",
  "credential", "signature",
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, "");
  return SENSITIVE_PATTERNS.some((p) =>
    normalized.includes(p.replace(/[-_\s]/g, ""))
  );
}

/** Recursively mask sensitive values in an object or array. */
export function maskObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(maskObject);
  if (typeof obj !== "object") return obj;

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      result[k] = typeof v === "string" && v.length > 0 ? "***" : "***";
    } else if (typeof v === "object" && v !== null) {
      result[k] = maskObject(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/** Mask the tail of a string, keeping only the first `visible` characters. */
export function maskString(value: string, visible = 4): string {
  if (!value) return "***";
  if (value.length <= visible) return "***";
  return value.slice(0, visible) + "*".repeat(Math.min(8, value.length - visible));
}

/** Mask sensitive keys in a flat FormData-like object (key → string). */
export function maskFields(
  fields: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = isSensitiveKey(k) ? "***" : v;
  }
  return result;
}
