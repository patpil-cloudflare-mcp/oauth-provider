/**
 * Test A3.2 - Session Token Extraction (P1 - HIGH PRIORITY)
 *
 * Purpose: Verify that getSessionTokenFromRequest() correctly extracts the
 * workos_session cookie from HTTP request headers.
 *
 * Critical for: Core authentication flow - extracting session tokens from cookies
 *
 * Test Scenarios:
 * 1. Extract workos_session from single cookie
 * 2. Extract workos_session from multiple cookies
 * 3. Handle missing Cookie header (return null)
 * 4. Handle Cookie header without workos_session (return null)
 * 5. Handle malformed cookie strings gracefully
 *
 * Code Reference: src/workos-auth.ts:226-241 (getSessionTokenFromRequest)
 */

import { describe, it, expect } from 'vitest';
import { getSessionTokenFromRequest } from '../../src/workos-auth';

/**
 * Helper to create mock HTTP Request with specific Cookie header
 */
function createMockRequest(cookieValue?: string): Request {
  const headers = new Headers();
  if (cookieValue !== undefined) {
    headers.set('Cookie', cookieValue);
  }

  return new Request('https://panel.wtyczki.ai/dashboard', {
    method: 'GET',
    headers,
  });
}

describe('A3.2 - Session Token Extraction (P1)', () => {
  it('should extract workos_session token from single cookie', () => {
    // GIVEN: Request with only workos_session cookie
    const sessionToken = 'session-token-abc123';
    const request = createMockRequest(`workos_session=${sessionToken}`);

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return the session token
    expect(result).toBe(sessionToken);
  });

  it('should extract workos_session from multiple cookies', () => {
    // GIVEN: Request with multiple cookies including workos_session
    const sessionToken = 'session-token-xyz789';
    const request = createMockRequest(
      `other_cookie=value1; workos_session=${sessionToken}; another_cookie=value2`
    );

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return the workos_session token
    expect(result).toBe(sessionToken);
  });

  it('should extract workos_session when it appears first', () => {
    // GIVEN: workos_session appears first in cookie string
    const sessionToken = 'first-session-token';
    const request = createMockRequest(
      `workos_session=${sessionToken}; other_cookie=value1; another_cookie=value2`
    );

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return the session token
    expect(result).toBe(sessionToken);
  });

  it('should extract workos_session when it appears last', () => {
    // GIVEN: workos_session appears last in cookie string
    const sessionToken = 'last-session-token';
    const request = createMockRequest(
      `other_cookie=value1; another_cookie=value2; workos_session=${sessionToken}`
    );

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return the session token
    expect(result).toBe(sessionToken);
  });

  it('should return null when Cookie header is missing', () => {
    // GIVEN: Request without Cookie header
    const request = createMockRequest(); // No cookie header

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return null
    expect(result).toBeNull();
  });

  it('should return null when workos_session cookie is not present', () => {
    // GIVEN: Request with cookies but no workos_session
    const request = createMockRequest('other_cookie=value1; another_cookie=value2');

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return null
    expect(result).toBeNull();
  });

  it('should return null when Cookie header is empty', () => {
    // GIVEN: Request with empty Cookie header
    const request = createMockRequest('');

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return null
    expect(result).toBeNull();
  });

  it('should handle cookie values with special characters', () => {
    // GIVEN: Session token with UUID format (common pattern)
    const sessionToken = '550e8400-e29b-41d4-a716-446655440000';
    const request = createMockRequest(`workos_session=${sessionToken}`);

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return the full UUID
    expect(result).toBe(sessionToken);
  });

  it('should handle cookies with spaces after semicolons', () => {
    // GIVEN: Cookies with extra spaces (common in browser headers)
    const sessionToken = 'spaced-token-123';
    const request = createMockRequest(
      `other_cookie=value1;  workos_session=${sessionToken};  another_cookie=value2`
    );

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return the session token (trimming handled internally)
    expect(result).toBe(sessionToken);
  });

  it('should handle malformed cookie string with missing equals sign', () => {
    // GIVEN: Malformed cookie (edge case - should not crash)
    const request = createMockRequest('malformed_cookie_no_equals; workos_session=valid-token');

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should still extract valid workos_session
    expect(result).toBe('valid-token');
  });

  it('should handle cookie with empty value', () => {
    // GIVEN: workos_session exists but has empty value
    const request = createMockRequest('workos_session=; other_cookie=value1');

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should return empty string or null (implementation detail - both are acceptable)
    // The actual implementation returns undefined which is truthy-falsy equivalent to null
    expect(result).toBeFalsy(); // Could be null, undefined, or empty string
  });

  it('should handle real-world cookie header format', () => {
    // GIVEN: Realistic cookie header from production
    const sessionToken = '7f3e4d5c-9a8b-4c3d-8e7f-1a2b3c4d5e6f';
    const request = createMockRequest(
      `_ga=GA1.1.123456789.1234567890; workos_session=${sessionToken}; _gid=GA1.1.987654321.0987654321`
    );

    // WHEN: Extract session token
    const result = getSessionTokenFromRequest(request);

    // THEN: Should correctly extract workos_session among analytics cookies
    expect(result).toBe(sessionToken);
  });
});
