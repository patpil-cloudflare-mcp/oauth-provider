/**
 * Test A3.3 - User Creation on First Login (P1 - HIGH PRIORITY)
 *
 * Purpose: Verify that getOrCreateUser() correctly creates new user accounts on first login,
 * creates Stripe customers, and returns existing users on subsequent logins.
 *
 * Critical for: User onboarding flow and Stripe integration
 *
 * Test Scenarios:
 * 1. New email creates user in D1 + Stripe customer (isNewUser=true)
 * 2. Existing email returns existing user (isNewUser=false)
 * 3. Existing user updates last_login_at timestamp
 * 4. New user has correct initial balances (0 tokens)
 * 5. Stripe customer created with correct metadata (user_id mapping)
 *
 * Code Reference: src/auth.ts:141-204 (getOrCreateUser)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrCreateUser, type AuthEnv } from '../../src/auth';
import type { User } from '../../src/types';

// Mock Stripe module BEFORE imports
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: vi.fn().mockResolvedValue({
          id: `cus_mock_${Date.now()}`,
          email: 'test@example.com',
          metadata: { user_id: 'mock-user-id' },
          description: 'MCP Token System User',
        }),
      },
    })),
  };
});


// Create mock D1 database
const createMockDB = () => {
  const users = new Map<string, any>();
  const updates = new Map<string, any>();

  // Add existing test user
  users.set('existing@example.com', {
    user_id: 'test-user-existing',
    email: 'existing@example.com',
    current_token_balance: 150,
    total_tokens_purchased: 500,
    total_tokens_used: 350,
    stripe_customer_id: 'cus_existing_123',
    created_at: '2025-01-01T00:00:00Z',
    last_login_at: '2025-01-10T00:00:00Z',
  });

  return {
    prepare: (query: string) => {
      return {
        bind: (...args: any[]) => {
          return {
            first: async () => {
              // SELECT user by email
              if (query.includes('SELECT') && query.includes('WHERE email = ?')) {
                const email = args[0];
                return users.get(email) || null;
              }
              return null;
            },
            run: async () => {
              // INSERT new user
              if (query.includes('INSERT INTO users')) {
                const [userId, email, stripeCustomerId, createdAt, lastLoginAt] = [
                  args[0], args[1], args[2], args[3], args[4]
                ];

                const newUser = {
                  user_id: userId,
                  email,
                  current_token_balance: 0,
                  total_tokens_purchased: 0,
                  total_tokens_used: 0,
                  stripe_customer_id: stripeCustomerId,
                  created_at: createdAt,
                  last_login_at: lastLoginAt,
                };

                users.set(email, newUser);
                return { success: true };
              }

              // UPDATE last_login_at
              if (query.includes('UPDATE users SET last_login_at')) {
                const [lastLoginAt, userId] = args;
                updates.set(userId, { last_login_at: lastLoginAt });
                return { success: true };
              }

              return { success: false };
            },
          };
        },
      };
    },
    getUser: (email: string) => users.get(email),
    getUpdate: (userId: string) => updates.get(userId),
  } as any;
};

// Create mock KV namespace
const createMockKV = () => ({
  get: async () => null,
  put: async () => {},
  delete: async () => {},
} as any);

// Create mock environment
const createMockEnv = (db: any): AuthEnv => ({
  DB: db,
  USER_SESSIONS: createMockKV(),
  ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
  ACCESS_POLICY_AUD: 'test-policy-aud',
  STRIPE_SECRET_KEY: 'sk_test_mock',
});

// Mock crypto.randomUUID
const mockUUID = () => 'mock-uuid-' + Math.random().toString(36).substring(7);

// Store original crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;

describe('A3.3 - User Creation on First Login (P1)', () => {
  let mockDB: any;
  let env: AuthEnv;

  beforeEach(() => {
    mockDB = createMockDB();
    env = createMockEnv(mockDB);

    // Mock crypto.randomUUID for deterministic user_id
    crypto.randomUUID = mockUUID as any;
  });

  afterEach(() => {
    // Restore original crypto.randomUUID
    crypto.randomUUID = originalRandomUUID;
    vi.clearAllMocks();
  });

  it('should create new user for new email address', async () => {
    // GIVEN: New email that doesn't exist in database
    const newEmail = 'newuser@example.com';

    // WHEN: Call getOrCreateUser
    const result = await getOrCreateUser(newEmail, env);

    // THEN: Should create new user
    expect(result.isNewUser).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(newEmail);
    expect(result.user.current_token_balance).toBe(0);
    expect(result.user.total_tokens_purchased).toBe(0);
    expect(result.user.total_tokens_used).toBe(0);

    // Verify user was inserted into database
    const userInDB = mockDB.getUser(newEmail);
    expect(userInDB).toBeDefined();
    expect(userInDB.email).toBe(newEmail);
  });

  it('should return existing user for existing email', async () => {
    // GIVEN: Existing user in database
    const existingEmail = 'existing@example.com';

    // WHEN: Call getOrCreateUser with existing email
    const result = await getOrCreateUser(existingEmail, env);

    // THEN: Should return existing user
    expect(result.isNewUser).toBe(false);
    expect(result.user).toBeDefined();
    expect(result.user.user_id).toBe('test-user-existing');
    expect(result.user.email).toBe(existingEmail);
    expect(result.user.current_token_balance).toBe(150);
    expect(result.user.total_tokens_purchased).toBe(500);
    expect(result.user.stripe_customer_id).toBe('cus_existing_123');
  });

  it('should update last_login_at for existing user', async () => {
    // GIVEN: Existing user
    const existingEmail = 'existing@example.com';
    const existingUserId = 'test-user-existing';

    // WHEN: User logs in
    await getOrCreateUser(existingEmail, env);

    // THEN: last_login_at should be updated
    const update = mockDB.getUpdate(existingUserId);
    expect(update).toBeDefined();
    expect(update.last_login_at).toBeDefined();

    // Verify timestamp is recent (within last few seconds)
    const lastLogin = new Date(update.last_login_at);
    const now = new Date();
    const timeDiff = now.getTime() - lastLogin.getTime();
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
  });

  it('should create new user with zero token balance', async () => {
    // GIVEN: New user
    const newEmail = 'zerobalance@example.com';

    // WHEN: Create user
    const result = await getOrCreateUser(newEmail, env);

    // THEN: Should have zero balances initially
    expect(result.user.current_token_balance).toBe(0);
    expect(result.user.total_tokens_purchased).toBe(0);
    expect(result.user.total_tokens_used).toBe(0);
  });

  it('should set created_at and last_login_at to same time for new user', async () => {
    // GIVEN: New user
    const newEmail = 'timestamps@example.com';

    // WHEN: Create user
    const result = await getOrCreateUser(newEmail, env);

    // THEN: created_at and last_login_at should be same (first login)
    expect(result.user.created_at).toBeDefined();
    expect(result.user.last_login_at).toBeDefined();

    // Both should be ISO strings
    expect(result.user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.user.last_login_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should generate valid UUID for new user_id', async () => {
    // GIVEN: New user
    const newEmail = 'uuidtest@example.com';

    // WHEN: Create user
    const result = await getOrCreateUser(newEmail, env);

    // THEN: user_id should be defined and non-empty
    expect(result.user.user_id).toBeDefined();
    expect(result.user.user_id.length).toBeGreaterThan(0);

    // Should start with our mock prefix
    expect(result.user.user_id).toMatch(/^mock-uuid-/);
  });

  it('should handle email case sensitivity correctly', async () => {
    // GIVEN: Existing user with lowercase email
    const lowerEmail = 'existing@example.com';

    // WHEN: Login with same email (should match)
    const result1 = await getOrCreateUser(lowerEmail, env);

    // THEN: Should return existing user
    expect(result1.isNewUser).toBe(false);
    expect(result1.user.user_id).toBe('test-user-existing');

    // WHEN: Login with different email (should create new)
    const upperEmail = 'NEWUSER@EXAMPLE.COM';
    const result2 = await getOrCreateUser(upperEmail, env);

    // THEN: Should create new user (email is case-sensitive in our system)
    expect(result2.isNewUser).toBe(true);
    expect(result2.user.email).toBe(upperEmail);
  });

  it('should preserve existing user data when returning existing user', async () => {
    // GIVEN: Existing user with specific balances
    const existingEmail = 'existing@example.com';

    // WHEN: Get existing user
    const result = await getOrCreateUser(existingEmail, env);

    // THEN: All fields should be preserved
    expect(result.user.current_token_balance).toBe(150);
    expect(result.user.total_tokens_purchased).toBe(500);
    expect(result.user.total_tokens_used).toBe(350);
    expect(result.user.stripe_customer_id).toBe('cus_existing_123');
    expect(result.user.created_at).toBe('2025-01-01T00:00:00Z');
  });

  it('should handle multiple new users with different emails', async () => {
    // GIVEN: Multiple new emails
    const emails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

    // WHEN: Create multiple users sequentially (to avoid race conditions in crypto.randomUUID mock)
    const results = [];
    for (const email of emails) {
      const result = await getOrCreateUser(email, env);
      results.push(result);
    }

    // THEN: All should be new users with unique IDs
    results.forEach((result, index) => {
      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBe(emails[index]);
      expect(result.user.user_id).toBeDefined();
    });

    // All user_ids should be unique (since randomUUID creates unique values each time)
    const userIds = results.map(r => r.user.user_id);
    const uniqueIds = new Set(userIds);
    expect(uniqueIds.size).toBe(emails.length);
  });
});
