/**
 * Placeholder webhook signature verification.
 * WithAllo does not document HMAC format; use raw header comparison until documented.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!secret) return true; // Skip verification when no secret configured
  if (!signatureHeader?.trim()) return false;

  // Placeholder: compare raw value (for X-Webhook-Signature: <secret> or similar)
  // Later: HMAC-SHA256(secret, rawBody) === signatureHeader
  const expected = secret.trim();
  return signatureHeader.trim() === expected;
}
