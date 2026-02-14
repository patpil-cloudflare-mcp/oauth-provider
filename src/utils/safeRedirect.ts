// src/utils/safeRedirect.ts - Prevent open redirect attacks

/**
 * Validate that a redirect target is a safe relative path.
 * Rejects absolute URLs, protocol-relative URLs, and other open redirect vectors.
 * Returns the fallback if the path is not safe.
 */
export function safeRedirectPath(path: string, fallback = '/dashboard'): string {
  if (!path) return fallback;

  // Must start with / (relative path)
  if (!path.startsWith('/')) return fallback;

  // Reject protocol-relative URLs (//evil.com)
  if (path.startsWith('//')) return fallback;

  // Reject paths with backslash (\/evil.com in some browsers)
  if (path.includes('\\')) return fallback;

  return path;
}
