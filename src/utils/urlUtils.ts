/**
 * Validates if a URL is safe to use in an image source.
 * Allows http, https, data, blob protocols and relative paths.
 * Blocks javascript:, vbscript:, and other potentially malicious protocols,
 * including those obfuscated with control characters.
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  // 1. Sanitize input: remove control characters (0x00-0x1F) which can be used to bypass string checks
  //    e.g. "java\0script:" might bypass a simple string check but execute in some browsers.
  // eslint-disable-next-line no-control-regex
  const sanitized = url.replace(/[\x00-\x1F]/g, "");

  try {
    // 2. Allow relative paths (explicitly safe prefixes)
    //    We check the sanitized version to ensure no hidden chars like ./java\0script: ...
    if (
      sanitized.startsWith("/") ||
      sanitized.startsWith("./") ||
      sanitized.startsWith("../")
    ) {
      return true;
    }

    // 3. Parse as URL
    const parsed = new URL(sanitized);

    // 4. Check Protocol Allowlist
    //    Note: protocol includes the trailing colon ':', e.g. "http:"
    const allowedProtocols = ["http:", "https:", "data:", "blob:"];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    // 5. Fallback for strings that failed URL parsing (e.g., extremely simple names or malformed paths)

    // Convert to lower case for case-insensitive scheme checks
    const lowerSafe = sanitized.trim().toLowerCase();

    // Explicitly block high-risk schemes if they couldn't be parsed as standard URLs
    // (This acts as a second line of defense for things like "javascript:..." that might fail new URL() in some edge cases
    //  or strictly relative paths that look suspicious)
    if (
      lowerSafe.startsWith("javascript:") ||
      lowerSafe.startsWith("vbscript:") ||
      lowerSafe.startsWith("data:")
    ) {
      // We don't support data: URIs that don't parse cleanly as URL objects
      return false;
    }

    // If it has a colon, it MIGHT be a scheme. If it got here (failed new URL),
    // it's either a relative path like "foo/bar:baz.png" (valid in some OSs) or a weird scheme.
    // To be safe, we reject unparsed strings with colons unless they look very much like file paths.
    // However, simplest safe default: if it has a colon and failed URL parsing, treat as unsafe/invalid
    // UNLESS we are sure it's just a file.

    // But for our file system app, standard filenames shouldn't have colons (except maybe C:\ on Windows specific logic,
    // but this is a web OS).
    // Let's stick to the previous logic but stricter:
    return !lowerSafe.includes(":");
  }
}
