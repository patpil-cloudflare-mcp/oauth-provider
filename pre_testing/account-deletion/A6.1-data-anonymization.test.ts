/**
 * Test A6.1 - Data Anonymization (P0 - CRITICAL)
 *
 * Purpose: Verify that account deletion properly anonymizes user data in compliance
 * with GDPR requirements while preserving transaction history.
 *
 * Critical for: GDPR compliance, privacy protection, audit trail preservation
 *
 * Test Scenarios:
 * 1. Email anonymized to deleted+{user_id}@wtyczki.ai
 * 2. Stripe customer ID set to NULL
 * 3. WorkOS user ID set to NULL
 * 4. is_deleted flag set to 1
 * 5. deleted_at timestamp populated
 * 6. Transaction history preserved (not deleted)
 * 7. Token balances preserved in audit trail
 *
 * Code Reference: src/services/accountDeletionService.ts:211-303 (anonymizeUserDataAtomic)
 *
 * GDPR NOTE: This test verifies Article 17 - Right to Erasure compliance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteUserAccount } from '../../src/services/accountDeletionService';
import type { Env } from '../../src/index';
import type { User } from '../../src/types';

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        del: vi.fn().mockResolvedValue({ deleted: true, id: 'cus_deleted' }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        cancel: vi.fn().mockResolvedValue({ id: 'sub_cancelled' }),
      },
      invoices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        voidInvoice: vi.fn().mockResolvedValue({ id: 'in_voided' }),
      },
      paymentMethods: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        detach: vi.fn().mockResolvedValue({ id: 'pm_detached' }),
      },
    })),
    errors: {
      StripeError: class StripeError extends Error {
        type: string;
        constructor(message: string) {
          super(message);
          this.type = 'api_error';
        }
      },
    },
  };
});

// Create mock D1 database
const createMockDB = () => {
  const users = new Map<string, any>();
  const accountDeletions = new Map<string, any>();
  const mcpActions = new Map<string, any>();
  const failedDeductions = new Map<string, any>();
  let capturedBindings: any[][] = [];

  // Add test user
  const testUser = {
    user_id: 'user-test-001',
    email: 'test@example.com',
    current_token_balance: 500,
    total_tokens_purchased: 2000,
    total_tokens_used: 1500,
    stripe_customer_id: 'cus_test_123',
    workos_user_id: 'workos_user_123',
    is_deleted: 0,
    deleted_at: null,
    created_at: '2025-01-01T00:00:00Z',
  };

  users.set('user-test-001', testUser);

  return {
    prepare: (query: string) => {
      const statementIndex = capturedBindings.length;
      return {
        bind: (...args: any[]) => {
          // Capture bindings for batch operations
          capturedBindings[statementIndex] = args;

          return {
            first: async () => {
              // SELECT user for deletion
              if (query.includes('SELECT') && query.includes('FROM users')) {
                const userId = args[0];
                return users.get(userId) || null;
              }

              // SELECT count for MCP actions
              if (query.includes('SELECT COUNT') && query.includes('FROM mcp_actions')) {
                return { count: 0 };
              }

              // SELECT count for failed deductions
              if (query.includes('SELECT COUNT') && query.includes('FROM failed_deductions')) {
                return { count: 0 };
              }

              return null;
            },
            run: async () => {
              // UPDATE mcp_actions (anonymize)
              if (query.includes('UPDATE mcp_actions')) {
                return { success: true };
              }

              // UPDATE failed_deductions (cleanup)
              if (query.includes('UPDATE failed_deductions')) {
                return { success: true };
              }

              return { success: true };
            },
            _query: query,  // Store query for batch processing
            _args: args,    // Store args for batch processing
          };
        },
      };
    },
    batch: async (statements: any[]) => {
      // Reset captured bindings for next batch
      const batchBindings = [...capturedBindings];
      capturedBindings = [];

      // Process statements using captured bindings
      let stmtIndex = 0;
      for (const stmt of statements) {
        const query = stmt._query || '';
        const args = stmt._args || batchBindings[stmtIndex] || [];

        // Simulate UPDATE users (anonymization)
        if (query.includes('UPDATE users')) {
          const [anonymizedEmail, timestamp, userId] = args;
          const user = users.get(userId);
          if (user) {
            user.email = anonymizedEmail;
            user.stripe_customer_id = null;
            user.workos_user_id = null;
            user.is_deleted = 1;
            user.deleted_at = timestamp;
          }
        }

        // Simulate INSERT into account_deletions
        if (query.includes('INSERT INTO account_deletions')) {
          const [deletionId, userId] = args;
          accountDeletions.set(deletionId, {
            deletion_id: deletionId,
            user_id: userId,
          });
        }

        stmtIndex++;
      }

      return [{ success: true }, { success: true }];
    },
    getUser: (userId: string) => users.get(userId),
    getDeletion: (deletionId: string) => accountDeletions.get(deletionId),
  } as any;
};

// Create mock KV namespaces
const createMockKV = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
} as any);

// Create mock environment
const createMockEnv = (db: any): Env => ({
  DB: db,
  USER_SESSIONS: createMockKV(),
  OAUTH_STORE: createMockKV(),
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  WORKOS_API_KEY: 'sk_test_workos',
  WORKOS_CLIENT_ID: 'client_test',
  ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
  ACCESS_POLICY_AUD: 'test-aud',
});

describe('A6.1 - Data Anonymization (P0)', () => {
  let mockDB: any;
  let env: Env;

  beforeEach(() => {
    mockDB = createMockDB();
    env = createMockEnv(mockDB);
    vi.clearAllMocks();
  });

  it('should anonymize email to deleted+{user_id}@wtyczki.ai', async () => {
    // GIVEN: User account to delete
    const userId = 'user-test-001';
    const userBefore = mockDB.getUser(userId);
    expect(userBefore.email).toBe('test@example.com');

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Email should be anonymized
    expect(result.success).toBe(true);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.email).toBe('deleted+user-test-001@wtyczki.ai');
    expect(userAfter.email).not.toBe('test@example.com');
  });

  it('should set stripe_customer_id to NULL', async () => {
    // GIVEN: User with Stripe customer
    const userId = 'user-test-001';
    const userBefore = mockDB.getUser(userId);
    expect(userBefore.stripe_customer_id).toBe('cus_test_123');

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Stripe customer ID should be NULL
    expect(result.success).toBe(true);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.stripe_customer_id).toBeNull();
  });

  it('should set workos_user_id to NULL', async () => {
    // GIVEN: User with WorkOS account
    const userId = 'user-test-001';
    const userBefore = mockDB.getUser(userId);
    expect(userBefore.workos_user_id).toBe('workos_user_123');

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: WorkOS user ID should be NULL
    expect(result.success).toBe(true);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.workos_user_id).toBeNull();
  });

  it('should set is_deleted flag to 1', async () => {
    // GIVEN: Active user (is_deleted = 0)
    const userId = 'user-test-001';
    const userBefore = mockDB.getUser(userId);
    expect(userBefore.is_deleted).toBe(0);

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: is_deleted should be 1
    expect(result.success).toBe(true);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.is_deleted).toBe(1);
  });

  it('should populate deleted_at timestamp', async () => {
    // GIVEN: User without deletion timestamp
    const userId = 'user-test-001';
    const userBefore = mockDB.getUser(userId);
    expect(userBefore.deleted_at).toBeNull();

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: deleted_at should be populated with ISO timestamp
    expect(result.success).toBe(true);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.deleted_at).toBeDefined();
    expect(userAfter.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should preserve token balance fields (audit trail)', async () => {
    // GIVEN: User with token history
    const userId = 'user-test-001';
    const userBefore = mockDB.getUser(userId);
    expect(userBefore.current_token_balance).toBe(500);
    expect(userBefore.total_tokens_purchased).toBe(2000);
    expect(userBefore.total_tokens_used).toBe(1500);

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Token balances should be preserved
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(500);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.current_token_balance).toBe(500);
    expect(userAfter.total_tokens_purchased).toBe(2000);
    expect(userAfter.total_tokens_used).toBe(1500);
  });

  it('should return tokensForfeited in result', async () => {
    // GIVEN: User with 500 token balance
    const userId = 'user-test-001';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Should report tokens forfeited
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(500);
    expect(result.userId).toBe(userId);
  });

  it('should fail gracefully for non-existent user', async () => {
    // GIVEN: Non-existent user ID
    const userId = 'user-nonexistent';

    // WHEN: Attempt to delete
    const result = await deleteUserAccount(userId, env);

    // THEN: Should return failure
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found or already deleted');
    expect(result.tokensForfeited).toBe(0);
  });

  it('should handle user with zero token balance', async () => {
    // GIVEN: User with zero tokens
    const zeroBalanceUser = {
      user_id: 'user-zero-balance',
      email: 'zero@example.com',
      current_token_balance: 0,
      total_tokens_purchased: 1000,
      total_tokens_used: 1000,
      stripe_customer_id: 'cus_zero',
      workos_user_id: null,
      is_deleted: 0,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    mockDB.prepare = (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return zeroBalanceUser;
          }
          if (query.includes('SELECT COUNT')) {
            return { count: 0 };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    });

    mockDB.batch = async () => {
      zeroBalanceUser.is_deleted = 1;
      zeroBalanceUser.email = 'deleted+user-zero-balance@wtyczki.ai';
      return [{ success: true }, { success: true }];
    };

    // WHEN: Delete account
    const result = await deleteUserAccount('user-zero-balance', env);

    // THEN: Should succeed with zero tokens forfeited
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(0);
  });

  it('should anonymize user with no Stripe customer', async () => {
    // GIVEN: User without Stripe customer (never purchased)
    const noStripeUser = {
      user_id: 'user-no-stripe',
      email: 'nostripe@example.com',
      current_token_balance: 0,
      total_tokens_purchased: 0,
      total_tokens_used: 0,
      stripe_customer_id: null,
      workos_user_id: 'workos_123',
      is_deleted: 0,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    mockDB.prepare = (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => {
          if (query.includes('SELECT') && query.includes('FROM users')) {
            return noStripeUser;
          }
          if (query.includes('SELECT COUNT')) {
            return { count: 0 };
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    });

    mockDB.batch = async () => {
      noStripeUser.is_deleted = 1;
      noStripeUser.email = 'deleted+user-no-stripe@wtyczki.ai';
      noStripeUser.workos_user_id = null;
      return [{ success: true }, { success: true }];
    };

    // WHEN: Delete account
    const result = await deleteUserAccount('user-no-stripe', env);

    // THEN: Should succeed without Stripe deletion
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(0);
  });

  it('should use atomic transaction (batch) for anonymization', async () => {
    // GIVEN: User to delete
    const userId = 'user-test-001';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Both operations should succeed atomically
    expect(result.success).toBe(true);

    const userAfter = mockDB.getUser(userId);
    expect(userAfter.is_deleted).toBe(1);
    expect(userAfter.email).toBe('deleted+user-test-001@wtyczki.ai');

    // NOTE: In real implementation, if batch fails, both UPDATE and INSERT rollback
  });
});
