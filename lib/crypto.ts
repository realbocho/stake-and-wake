import crypto from "crypto";

export function hmacSha256Hex(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function sha256Hex(payload: string) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}
