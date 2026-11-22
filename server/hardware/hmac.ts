import "server-only"
import crypto from "node:crypto"

export interface CanonicalHmacParams {
  method: string
  path: string
  timestamp: string
  nonce: string
  keyVersion: string | number
  bodySha256: string
}

/**
 * Builds the canonical string representation for HMAC-SHA-256 signing.
 * Format:
 *   METHOD\n
 *   PATH\n
 *   TIMESTAMP\n
 *   NONCE\n
 *   KEY_VERSION\n
 *   BODY_SHA256
 */
export function buildCanonicalHmacString(params: CanonicalHmacParams): string {
  return [
    params.method.toUpperCase(),
    params.path,
    params.timestamp,
    params.nonce,
    String(params.keyVersion),
    params.bodySha256,
  ].join("\n")
}

export function computeBodySha256(
  rawBody: Buffer | Uint8Array | string
): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex")
}

export function computeHmacSignature(
  canonicalString: string,
  secretKey: string
): string {
  return crypto
    .createHmac("sha256", secretKey)
    .update(canonicalString)
    .digest("hex")
}

export function verifyHmacSignature(
  signature: string,
  canonicalString: string,
  secretKey: string
): boolean {
  try {
    const expected = computeHmacSignature(canonicalString, secretKey)
    const sigBuf = Buffer.from(signature, "hex")
    const expBuf = Buffer.from(expected, "hex")
    if (sigBuf.length !== expBuf.length) {
      return false
    }
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

export function validateTimestampSkew(
  timestampIso: string,
  maxSkewMs = 5 * 60 * 1000
): { valid: boolean; skewMs: number; error?: string } {
  const ts = new Date(timestampIso).getTime()
  if (isNaN(ts)) {
    return {
      valid: false,
      skewMs: Infinity,
      error: "Invalid ISO-8601 timestamp format",
    }
  }
  const now = Date.now()
  const skewMs = Math.abs(now - ts)
  if (skewMs > maxSkewMs) {
    return {
      valid: false,
      skewMs,
      error: `Timestamp skew of ${Math.round(skewMs / 1000)}s exceeds allowable maximum of ${maxSkewMs / 1000}s`,
    }
  }
  return { valid: true, skewMs }
}
