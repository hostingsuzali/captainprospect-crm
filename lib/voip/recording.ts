const ALLO_HOST = "api.withallo.com";

/**
 * If the recording URL points to WithAllo's API (which requires auth),
 * rewrite it through our authenticated proxy. Other URLs pass through as-is.
 */
export function proxyRecordingUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === ALLO_HOST) {
      return `/api/voip/recording?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // malformed URL — return as-is
  }
  return url;
}
