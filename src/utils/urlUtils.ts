/**
 * Sanitizes and validates a URL for use in an image source.
 * Returns the sanitized string (safe to use) or null if invalid.
 * This pattern helps static analysis tools (like CodeQL) verify that data has been sanitized.
 */
export function getSafeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // 1. Sanitize input: remove control characters (0x00-0x1F)
  // eslint-disable-next-line no-control-regex
  const sanitized = url.replace(/[\x00-\x1F]/g, "");

  try {
    // 2. Allow relative paths (explicitly safe prefixes)
    if (
      sanitized.startsWith("/") ||
      sanitized.startsWith("./") ||
      sanitized.startsWith("../")
    ) {
      return sanitized;
    }

    // 3. Parse as URL
    const parsed = new URL(sanitized);

    // 4. Check Protocol Allowlist
    const allowedProtocols = ["http:", "https:", "data:", "blob:"];
    if (allowedProtocols.includes(parsed.protocol)) {
      return sanitized;
    }
    
    return null;

  } catch {
    // 5. Fallback for strings that failed URL parsing
    const lowerSafe = sanitized.trim().toLowerCase();

    // Block known malicious schemes
    if (
      lowerSafe.startsWith("javascript:") ||
      lowerSafe.startsWith("vbscript:") ||
      lowerSafe.startsWith("data:")
    ) {
      return null;
    }

    // Block potential schemes (strings with colons) if they didn't parse as URLs
    // unless strictly a file path
    if (lowerSafe.includes(":")) {
      return null;
    }

    // Assume safe filename
    return sanitized;
  }
}

/**
 * Legacy validator - wrapper around getSafeImageUrl.
 * @deprecated Use getSafeImageUrl instead to ensure taint tracking works.
 */
export function isValidImageUrl(url: string): boolean {
  return getSafeImageUrl(url) !== null;
}
