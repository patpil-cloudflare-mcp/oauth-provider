// src/utils/crypto.ts - Cryptographic Utilities for GDPR Compliance
// Provides hash functions for anonymizing PII while maintaining audit trail

/**
 * Generate SHA-256 hash of email address
 *
 * GDPR Compliance: Hash PII instead of storing plaintext
 *
 * Use cases:
 * - Deletion audit trail (detect re-registration)
 * - GDPR-compliant logging
 * - Cannot reverse to recover original email
 *
 * @param email - Email address to hash
 * @returns Hex-encoded SHA-256 hash (64 characters)
 *
 * @example
 * const hash = await hashEmail('user@example.com');
 * // Returns: 'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514'
 */
export async function hashEmail(email: string): Promise<string> {
  // Normalize email (lowercase, trim whitespace)
  const normalized = email.toLowerCase().trim();

  // Encode to bytes
  const msgUint8 = new TextEncoder().encode(normalized);

  // SHA-256 hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);

  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

/**
 * Verify if email matches a given hash
 *
 * Use case: Check if user is re-registering after deletion
 *
 * @param email - Email to verify
 * @param hash - Expected SHA-256 hash
 * @returns True if email produces the same hash
 *
 * @example
 * const isMatch = await verifyEmailHash('user@example.com', storedHash);
 * if (isMatch) {
 *   console.log('User previously deleted account');
 * }
 */
export async function verifyEmailHash(email: string, hash: string): Promise<boolean> {
  const computedHash = await hashEmail(email);
  return computedHash === hash;
}

/**
 * Hash email for case-insensitive comparison
 *
 * Same as hashEmail() but explicitly named for clarity
 * All emails are normalized to lowercase before hashing
 *
 * @param email - Email address
 * @returns SHA-256 hash
 */
export async function hashEmailCaseInsensitive(email: string): Promise<string> {
  return hashEmail(email); // Already case-insensitive
}

/**
 * Check if user with this email was previously deleted
 *
 * Helper function that queries account_deletions table
 *
 * @param email - Email to check
 * @param db - D1 Database instance
 * @returns Deletion record if found, null otherwise
 */
export async function checkPreviousDeletion(
  email: string,
  db: D1Database
): Promise<{ deletionId: string; deletedAt: string } | null> {
  // Normalize email for comparison
  const normalizedEmail = email.toLowerCase().trim();

  const result = await db.prepare(`
    SELECT deletion_id as deletionId, deleted_at as deletedAt
    FROM account_deletions
    WHERE LOWER(original_email) = ?
    ORDER BY deleted_at DESC
    LIMIT 1
  `).bind(normalizedEmail).first<{ deletionId: string; deletedAt: string }>();

  return result || null;
}
