/**
 * Test A3.1 - Session Validation (P0 - CRITICAL)
 *
 * Purpose: Verify that validateSession() correctly validates WorkOS session tokens,
 * handles expiration, and returns proper error states.
 *
 * Critical for: Security - ensuring only valid, non-expired sessions gain access
 *
 * Test Scenarios:
 * 1. Valid session returns user successfully
 * 2. Expired session returns error and deletes from KV
 * 3. Invalid/missing session returns error
 * 4. Session with non-existent user returns error
 *
 * Code Reference: src/workos-auth.ts:126-179 (validateSession)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateSession, type SessionResult, type WorkOSAuthEnv } from '../../src/workos-auth';

// Mock WorkOS session data structure
interface MockWorkOSSession {
  user_id: string;
  email: string;
  workos_user_id: string;
  access_token: string;
  refresh_token: string;
  created_at: number;
  expires_at: number;
}

// Create mock KV namespace for session storage
const createMockKV = () => {
  const store = new Map<string, string>();
  const deletedKeys = new Set<string>();

  return {
    get: async (key: string, type?: 'json' | 'text') => {
      const value = store.get(key);
      if (!value) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string, options?: any) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      deletedKeys.add(key);
      store.delete(key);
    },
    getDeletedKeys: () => Array.from(deletedKeys),
    clearDeletedKeys: () => deletedKeys.clear(),
  } as any;
};

// Create mock D1 database
const createMockDB = () => {
  const users = new Map<string, any>();

  // Add test user
  users.set('test-user-valid', {
    user_id: 'test-user-valid',
    email: 'valid@example.com',
    current_token_balance: 100,
    total_tokens_purchased: 200,
    total_tokens_used: 100,
    stripe_customer_id: 'cus_test_valid',
    created_at: '2025-01-01T00:00:00Z',
    last_login_at: '2025-01-15T00:00:00Z',
  });

  return {
    prepare: (query: string) => {
      return {
        bind: (...args: any[]) => {
          return {
            first: async () => {
              // SELECT user query
              if (query.includes('SELECT') && query.includes('FROM users')) {
                const userId = args[0];
                const user = users.get(userId);
                return user || null;
              }
              return null;
            },
          };
        },
      };
    },
  } as any;
};

// Create mock environment
const createMockEnv = (kv: any, db: any): WorkOSAuthEnv => ({
  DB: db,
  USER_SESSIONS: kv,
  WORKOS_API_KEY: 'sk_test_mock',
  WORKOS_CLIENT_ID: 'client_test_mock',
  STRIPE_SECRET_KEY: 'sk_test_mock_stripe',
});

describe('A3.1 - Session Validation (P0)', () => {
  let mockKV: any;
  let mockDB: any;
  let env: WorkOSAuthEnv;

  beforeEach(() => {
    mockKV = createMockKV();
    mockDB = createMockDB();
    env = createMockEnv(mockKV, mockDB);
  });

  it('should return success=true and user for valid, non-expired session', async () => {
    // GIVEN: Valid session stored in KV
    const sessionToken = 'session-token-valid';
    const session: MockWorkOSSession = {
      user_id: 'test-user-valid',
      email: 'valid@example.com',
      workos_user_id: 'workos_user_123',
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_123',
      created_at: Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago
      expires_at: Date.now() + (23 * 60 * 60 * 1000), // Expires in 23 hours
    };

    await mockKV.put(`workos_session:${sessionToken}`, JSON.stringify(session));

    // WHEN: Validate session
    const result: SessionResult = await validateSession(sessionToken, env);

    // THEN: Should return success with user object
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.user_id).toBe('test-user-valid');
    expect(result.user?.email).toBe('valid@example.com');
    expect(result.user?.current_token_balance).toBe(100);
    expect(result.error).toBeUndefined();
  });

  it('should return error for expired session and delete from KV', async () => {
    // GIVEN: Expired session stored in KV
    const sessionToken = 'session-token-expired';
    const session: MockWorkOSSession = {
      user_id: 'test-user-valid',
      email: 'valid@example.com',
      workos_user_id: 'workos_user_123',
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_123',
      created_at: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      expires_at: Date.now() - (1 * 60 * 60 * 1000), // Expired 1 hour ago
    };

    await mockKV.put(`workos_session:${sessionToken}`, JSON.stringify(session));
    mockKV.clearDeletedKeys();

    // WHEN: Validate expired session
    const result: SessionResult = await validateSession(sessionToken, env);

    // THEN: Should return error and delete session from KV
    expect(result.success).toBe(false);
    expect(result.error).toBe('Session expired');
    expect(result.user).toBeUndefined();

    // Verify session was deleted from KV
    const deletedKeys = mockKV.getDeletedKeys();
    expect(deletedKeys).toContain(`workos_session:${sessionToken}`);
  });

  it('should return error for non-existent session (not found in KV)', async () => {
    // GIVEN: No session in KV
    const sessionToken = 'session-token-nonexistent';

    // WHEN: Validate non-existent session
    const result: SessionResult = await validateSession(sessionToken, env);

    // THEN: Should return error
    expect(result.success).toBe(false);
    expect(result.error).toBe('Session not found or expired');
    expect(result.user).toBeUndefined();
  });

  it('should return error when session user_id does not exist in database', async () => {
    // GIVEN: Valid session in KV but user deleted from database
    const sessionToken = 'session-token-orphaned';
    const session: MockWorkOSSession = {
      user_id: 'test-user-deleted', // User not in database
      email: 'deleted@example.com',
      workos_user_id: 'workos_user_deleted',
      access_token: 'access_token_deleted',
      refresh_token: 'refresh_token_deleted',
      created_at: Date.now() - (1 * 60 * 60 * 1000),
      expires_at: Date.now() + (23 * 60 * 60 * 1000), // Not expired
    };

    await mockKV.put(`workos_session:${sessionToken}`, JSON.stringify(session));

    // WHEN: Validate session with non-existent user
    const result: SessionResult = await validateSession(sessionToken, env);

    // THEN: Should return error
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
    expect(result.user).toBeUndefined();
  });

  it('should return error for malformed session data', async () => {
    // GIVEN: Invalid JSON in KV
    const sessionToken = 'session-token-malformed';

    // Put invalid JSON directly (bypassing JSON.stringify)
    await mockKV.put(`workos_session:${sessionToken}`, '{invalid json}');

    // WHEN: Validate malformed session
    const result: SessionResult = await validateSession(sessionToken, env);

    // THEN: Should return error gracefully
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle exactly at expiration timestamp (edge case)', async () => {
    // GIVEN: Session expiring 1 millisecond ago (clearly expired)
    const now = Date.now();
    const sessionToken = 'session-token-edge-expiration';
    const session: MockWorkOSSession = {
      user_id: 'test-user-valid',
      email: 'valid@example.com',
      workos_user_id: 'workos_user_123',
      access_token: 'access_token_123',
      refresh_token: 'refresh_token_123',
      created_at: now - (24 * 60 * 60 * 1000),
      expires_at: now - 1, // Expired 1ms ago
    };

    await mockKV.put(`workos_session:${sessionToken}`, JSON.stringify(session));
    mockKV.clearDeletedKeys();

    // WHEN: Validate expired session
    const result: SessionResult = await validateSession(sessionToken, env);

    // THEN: Should be treated as expired
    expect(result.success).toBe(false);
    expect(result.error).toBe('Session expired');

    // Verify session was deleted from KV
    const deletedKeys = mockKV.getDeletedKeys();
    expect(deletedKeys).toContain(`workos_session:${sessionToken}`);
  });
});