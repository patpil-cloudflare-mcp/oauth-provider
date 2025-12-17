/**
 * Test A4.1 - OAuth Token Validation (P1 - HIGH PRIORITY)
 *
 * Purpose: Verify that validateOAuthToken() correctly validates OAuth access tokens,
 * handles expiration, and prevents deleted users from accessing resources.
 *
 * Critical for: Security for MCP access - ensuring only valid tokens grant access
 *
 * Test Scenarios:
 * 1. Valid token returns user_id
 * 2. Expired token returns null and deletes from KV
 * 3. Non-existent token returns null
 * 4. Deleted user's token returns null and is revoked
 * 5. Token for non-existent user returns null
 *
 * Code Reference: src/oauth.ts:408-440 (validateOAuthToken)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateOAuthToken, type OAuthEnv } from '../../src/oauth';
import type { OAuthAccessToken } from '../../src/types';

// Create mock KV namespace for OAuth token storage
const createMockOAuthKV = () => {
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

  // Add active test user
  users.set('user-active-001', {
    user_id: 'user-active-001',
    email: 'active@example.com',
    is_deleted: 0,
  });

  // Add deleted test user
  users.set('user-deleted-001', {
    user_id: 'user-deleted-001',
    email: 'deleted@example.com',
    is_deleted: 1,
  });

  return {
    prepare: (query: string) => {
      return {
        bind: (...args: any[]) => {
          return {
            first: async () => {
              // SELECT is_deleted FROM users WHERE user_id = ?
              if (query.includes('SELECT is_deleted FROM users')) {
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
const createMockEnv = (oauthKV: any, db: any): OAuthEnv => ({
  DB: db,
  USER_SESSIONS: {} as any,
  OAUTH_STORE: oauthKV,
  ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
  ACCESS_POLICY_AUD: 'test-policy-aud',
  STRIPE_SECRET_KEY: 'sk_test_mock',
});

describe('A4.1 - OAuth Token Validation (P1)', () => {
  let mockOAuthKV: any;
  let mockDB: any;
  let env: OAuthEnv;

  beforeEach(() => {
    mockOAuthKV = createMockOAuthKV();
    mockDB = createMockDB();
    env = createMockEnv(mockOAuthKV, mockDB);
  });

  it('should return user_id for valid, non-expired token', async () => {
    // GIVEN: Valid OAuth access token in KV
    const accessToken = 'token-valid-123';
    const tokenData: OAuthAccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      user_id: 'user-active-001',
      client_id: 'client-test',
      scopes: ['read', 'write'],
      expires_at: Date.now() + (60 * 60 * 1000), // Expires in 1 hour
      created_at: Date.now() - (5 * 60 * 1000), // Created 5 minutes ago
    };

    await mockOAuthKV.put(`access_token:${accessToken}`, JSON.stringify(tokenData));

    // WHEN: Validate token
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should return user_id
    expect(result).toBe('user-active-001');
  });

  it('should return null for expired token and delete from KV', async () => {
    // GIVEN: Expired OAuth access token in KV
    const accessToken = 'token-expired-123';
    const tokenData: OAuthAccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      user_id: 'user-active-001',
      client_id: 'client-test',
      scopes: ['read'],
      expires_at: Date.now() - (10 * 60 * 1000), // Expired 10 minutes ago
      created_at: Date.now() - (70 * 60 * 1000), // Created 70 minutes ago
    };

    await mockOAuthKV.put(`access_token:${accessToken}`, JSON.stringify(tokenData));
    mockOAuthKV.clearDeletedKeys();

    // WHEN: Validate expired token
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should return null and delete token from KV
    expect(result).toBeNull();

    // Verify token was deleted from KV
    const deletedKeys = mockOAuthKV.getDeletedKeys();
    expect(deletedKeys).toContain(`access_token:${accessToken}`);
  });

  it('should return null for non-existent token', async () => {
    // GIVEN: Token not in KV
    const accessToken = 'token-nonexistent';

    // WHEN: Validate non-existent token
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should return null
    expect(result).toBeNull();
  });

  it('should return null for deleted user and revoke token', async () => {
    // GIVEN: Valid token but user is deleted (is_deleted=1)
    const accessToken = 'token-deleted-user';
    const tokenData: OAuthAccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      user_id: 'user-deleted-001', // User is deleted
      client_id: 'client-test',
      scopes: ['read'],
      expires_at: Date.now() + (60 * 60 * 1000), // Not expired
      created_at: Date.now() - (5 * 60 * 1000),
    };

    await mockOAuthKV.put(`access_token:${accessToken}`, JSON.stringify(tokenData));
    mockOAuthKV.clearDeletedKeys();

    // WHEN: Validate token for deleted user
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should return null and revoke token
    expect(result).toBeNull();

    // Verify token was deleted from KV (revoked)
    const deletedKeys = mockOAuthKV.getDeletedKeys();
    expect(deletedKeys).toContain(`access_token:${accessToken}`);
  });

  it('should return null for token with non-existent user_id', async () => {
    // GIVEN: Valid token but user_id does not exist in database
    const accessToken = 'token-orphaned';
    const tokenData: OAuthAccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      user_id: 'user-nonexistent-999', // User not in database
      client_id: 'client-test',
      scopes: ['read'],
      expires_at: Date.now() + (60 * 60 * 1000), // Not expired
      created_at: Date.now() - (5 * 60 * 1000),
    };

    await mockOAuthKV.put(`access_token:${accessToken}`, JSON.stringify(tokenData));
    mockOAuthKV.clearDeletedKeys();

    // WHEN: Validate token
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should return null and revoke token
    expect(result).toBeNull();

    // Verify token was deleted (revoked)
    const deletedKeys = mockOAuthKV.getDeletedKeys();
    expect(deletedKeys).toContain(`access_token:${accessToken}`);
  });

  it('should handle exactly at expiration timestamp (edge case)', async () => {
    // GIVEN: Token expiring 1 millisecond ago (clearly expired)
    const accessToken = 'token-edge-expiration';
    const tokenData: OAuthAccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      user_id: 'user-active-001',
      client_id: 'client-test',
      scopes: ['read'],
      expires_at: Date.now() - 1, // Expired 1ms ago
      created_at: Date.now() - (60 * 60 * 1000),
    };

    await mockOAuthKV.put(`access_token:${accessToken}`, JSON.stringify(tokenData));
    mockOAuthKV.clearDeletedKeys();

    // WHEN: Validate expired token
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should be treated as expired
    expect(result).toBeNull();

    // Verify token was deleted
    const deletedKeys = mockOAuthKV.getDeletedKeys();
    expect(deletedKeys).toContain(`access_token:${accessToken}`);
  });

  it('should validate token close to expiration (still valid)', async () => {
    // GIVEN: Token expiring in 1 second (still valid)
    const accessToken = 'token-almost-expired';
    const tokenData: OAuthAccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      user_id: 'user-active-001',
      client_id: 'client-test',
      scopes: ['read'],
      expires_at: Date.now() + 1000, // Expires in 1 second
      created_at: Date.now() - (59 * 60 * 1000), // Created 59 minutes ago
    };

    await mockOAuthKV.put(`access_token:${accessToken}`, JSON.stringify(tokenData));

    // WHEN: Validate token
    const result = await validateOAuthToken(accessToken, env);

    // THEN: Should still be valid
    expect(result).toBe('user-active-001');
  });

  it('should handle multiple tokens for same user independently', async () => {
    // GIVEN: User has multiple active tokens
    const token1 = 'token-user1-session1';
    const token2 = 'token-user1-session2';

    const tokenData1: OAuthAccessToken = {
      access_token: token1,
      token_type: 'Bearer',
      user_id: 'user-active-001',
      client_id: 'client-test',
      scopes: ['read'],
      expires_at: Date.now() + (60 * 60 * 1000),
      created_at: Date.now() - (10 * 60 * 1000),
    };

    const tokenData2: OAuthAccessToken = {
      access_token: token2,
      token_type: 'Bearer',
      user_id: 'user-active-001',
      client_id: 'client-test',
      scopes: ['read', 'write'],
      expires_at: Date.now() + (30 * 60 * 1000),
      created_at: Date.now() - (5 * 60 * 1000),
    };

    await mockOAuthKV.put(`access_token:${token1}`, JSON.stringify(tokenData1));
    await mockOAuthKV.put(`access_token:${token2}`, JSON.stringify(tokenData2));

    // WHEN: Validate both tokens
    const result1 = await validateOAuthToken(token1, env);
    const result2 = await validateOAuthToken(token2, env);

    // THEN: Both should be valid and return same user_id
    expect(result1).toBe('user-active-001');
    expect(result2).toBe('user-active-001');
  });
});
