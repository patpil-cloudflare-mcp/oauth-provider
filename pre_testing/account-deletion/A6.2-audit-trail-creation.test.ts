/**
 * Test A6.2 - Audit Trail Creation (P0 - CRITICAL)
 *
 * Purpose: Verify that account deletion creates a complete audit record in
 * account_deletions table for compliance and reconciliation purposes.
 *
 * Critical for: Compliance auditing, dispute resolution, financial reconciliation
 *
 * Test Scenarios:
 * 1. Deletion record created with deletion_id
 * 2. Email hash matches SHA-256(original_email)
 * 3. tokens_forfeited recorded correctly
 * 4. total_tokens_purchased preserved
 * 5. total_tokens_used preserved
 * 6. deleted_at timestamp populated
 * 7. Stripe customer deletion status tracked
 * 8. MCP actions anonymization count tracked
 * 9. Failed deductions cleanup count tracked
 * 10. No-refund acknowledgment recorded
 *
 * Code Reference: src/services/accountDeletionService.ts:246-283 (audit record creation)
 *
 * COMPLIANCE NOTE: Audit trail is permanent and never deleted (tax/legal requirement)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteUserAccount } from '../../src/services/accountDeletionService';
import { hashEmail } from '../../src/utils/crypto';
import type { Env } from '../../src/index';

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        del: vi.fn().mockResolvedValue({ deleted: true, id: 'cus_deleted' }),
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      invoices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      paymentMethods: {
        list: vi.fn().mockResolvedValue({ data: [] }),
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

// Create mock D1 database with audit trail tracking
const createMockDB = () => {
  const users = new Map<string, any>();
  const accountDeletions: any[] = [];

  // Add test user
  const testUser = {
    user_id: 'user-audit-test',
    email: 'audit@example.com',
    current_token_balance: 1000,
    total_tokens_purchased: 5000,
    total_tokens_used: 4000,
    stripe_customer_id: 'cus_audit_123',
    workos_user_id: 'workos_audit',
    is_deleted: 0,
    deleted_at: null,
    created_at: '2025-01-01T00:00:00Z',
  };

  users.set('user-audit-test', testUser);

  let capturedBindings: any[][] = [];

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
                return { count: 3 }; // Simulate 3 MCP actions
              }

              // SELECT count for failed deductions
              if (query.includes('SELECT COUNT') && query.includes('FROM failed_deductions')) {
                return { count: 2 }; // Simulate 2 failed deductions
              }

              return null;
            },
            run: async () => {
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

      // Process both UPDATE and INSERT
      let stmtIndex = 0;
      for (const stmt of statements) {
        const query = stmt._query || '';
        const args = stmt._args || batchBindings[stmtIndex] || [];

        // Handle INSERT into account_deletions
        if (query.includes('INSERT INTO account_deletions')) {
          const [
            deletionId,
            userId,
            originalEmail,
            emailHash,
            tokensForfeited,
            totalTokensPurchased,
            totalTokensUsed,
            stripeCustomerId,
            stripeCustomerDeleted,
            stripeDeletionError,
            mcpActionsAnonymized,
            failedDeductionsCleaned,
            userAcknowledgedNoRefund,
            deletionReason,
            deletedAt,
            deletedByIp,
          ] = args;

          accountDeletions.push({
            deletion_id: deletionId,
            user_id: userId,
            original_email: originalEmail,
            email_hash: emailHash,
            tokens_forfeited: tokensForfeited,
            total_tokens_purchased: totalTokensPurchased,
            total_tokens_used: totalTokensUsed,
            stripe_customer_id: stripeCustomerId,
            stripe_customer_deleted: stripeCustomerDeleted,
            stripe_deletion_error: stripeDeletionError,
            mcp_actions_anonymized: mcpActionsAnonymized,
            failed_deductions_cleaned: failedDeductionsCleaned,
            user_acknowledged_no_refund: userAcknowledgedNoRefund,
            deletion_reason: deletionReason,
            deleted_at: deletedAt,
            deleted_by_ip: deletedByIp,
          });
        }

        // Handle UPDATE users (anonymization)
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

        stmtIndex++;
      }

      return [{ success: true }, { success: true }];
    },
    getAuditRecords: () => accountDeletions,
    getLatestAuditRecord: () => accountDeletions[accountDeletions.length - 1],
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

describe('A6.2 - Audit Trail Creation (P0)', () => {
  let mockDB: any;
  let env: Env;

  beforeEach(() => {
    mockDB = createMockDB();
    env = createMockEnv(mockDB);
    vi.clearAllMocks();
  });

  it('should create audit record with deletion_id', async () => {
    // GIVEN: User account to delete
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit record should be created
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord).toBeDefined();
    expect(auditRecord.deletion_id).toBeDefined();
    expect(auditRecord.deletion_id).toMatch(/^[a-f0-9-]{36}$/); // UUID format
  });

  it('should record original email in audit trail', async () => {
    // GIVEN: User with email
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Original email should be in audit record
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.original_email).toBe('audit@example.com');
  });

  it('should store email_hash matching SHA-256(email)', async () => {
    // GIVEN: User with email
    const userId = 'user-audit-test';
    const originalEmail = 'audit@example.com';
    const expectedHash = await hashEmail(originalEmail);

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Email hash should match SHA-256
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.email_hash).toBe(expectedHash);
    expect(auditRecord.email_hash).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('should record tokens_forfeited correctly', async () => {
    // GIVEN: User with 1000 token balance
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit record should show 1000 tokens forfeited
    expect(result.success).toBe(true);
    expect(result.tokensForfeited).toBe(1000);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.tokens_forfeited).toBe(1000);
  });

  it('should preserve total_tokens_purchased in audit', async () => {
    // GIVEN: User purchased 5000 tokens total
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit should record total purchased
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.total_tokens_purchased).toBe(5000);
  });

  it('should preserve total_tokens_used in audit', async () => {
    // GIVEN: User used 4000 tokens total
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit should record total used
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.total_tokens_used).toBe(4000);
  });

  it('should populate deleted_at timestamp', async () => {
    // GIVEN: User to delete
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit record should have deletion timestamp
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.deleted_at).toBeDefined();
    expect(auditRecord.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should track Stripe customer deletion status', async () => {
    // GIVEN: User with Stripe customer
    const userId = 'user-audit-test';

    // WHEN: Delete account (Stripe deletion succeeds)
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit should record Stripe deletion success
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.stripe_customer_id).toBe('cus_audit_123');
    expect(auditRecord.stripe_customer_deleted).toBe(1); // Success
    expect(auditRecord.stripe_deletion_error).toBeNull();
  });

  it('should track MCP actions anonymization count', async () => {
    // GIVEN: User with 3 MCP actions (mocked in DB)
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit should record 3 actions anonymized
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.mcp_actions_anonymized).toBe(3);
  });

  it('should track failed deductions cleanup count', async () => {
    // GIVEN: User with 2 unresolved failed deductions (mocked in DB)
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit should record 2 deductions cleaned
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.failed_deductions_cleaned).toBe(2);
  });

  it('should record no-refund acknowledgment', async () => {
    // GIVEN: User acknowledges no-refund policy
    const userId = 'user-audit-test';

    // WHEN: Delete account with acknowledgment
    const result = await deleteUserAccount(
      userId,
      env,
      'User requested deletion',
      '192.168.1.1',
      true // acknowledgedNoRefund = true
    );

    // THEN: Audit should record acknowledgment
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.user_acknowledged_no_refund).toBe(1);
  });

  it('should record deletion reason if provided', async () => {
    // GIVEN: User provides deletion reason
    const userId = 'user-audit-test';
    const reason = 'Privacy concerns';

    // WHEN: Delete account with reason
    const result = await deleteUserAccount(userId, env, reason);

    // THEN: Audit should include reason
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.deletion_reason).toBe('Privacy concerns');
  });

  it('should record IP address if provided', async () => {
    // GIVEN: User deletes from specific IP
    const userId = 'user-audit-test';
    const ipAddress = '203.0.113.42';

    // WHEN: Delete account with IP tracking
    const result = await deleteUserAccount(userId, env, undefined, ipAddress);

    // THEN: Audit should include IP
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.deleted_by_ip).toBe('203.0.113.42');
  });

  it('should handle deletion without optional fields', async () => {
    // GIVEN: User deletion with minimal data
    const userId = 'user-audit-test';

    // WHEN: Delete without reason or IP
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit record should have nulls for optional fields
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord.deletion_reason).toBeNull();
    expect(auditRecord.deleted_by_ip).toBeNull();
  });

  it('should create audit record even if Stripe deletion fails', async () => {
    // GIVEN: User with Stripe customer that fails to delete
    // Mock Stripe to fail
    const Stripe = (await import('stripe')).default;
    const mockStripe = new Stripe('sk_test_mock', { apiVersion: '2025-09-30.clover' } as any);
    (mockStripe.customers.del as any).mockRejectedValue(new Error('Stripe API error'));

    const userId = 'user-audit-test';

    // WHEN: Delete account (Stripe fails)
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit record should still be created with error tracking
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    expect(auditRecord).toBeDefined();
    expect(auditRecord.stripe_customer_deleted).toBe(0); // Failed
    // Note: stripe_deletion_error would contain error message in real scenario
  });

  it('should calculate accurate token balance for audit', async () => {
    // GIVEN: User with specific token history
    // current_balance = 1000
    // purchased = 5000
    // used = 4000
    // Should equal: 5000 - 4000 = 1000
    const userId = 'user-audit-test';

    // WHEN: Delete account
    const result = await deleteUserAccount(userId, env);

    // THEN: Audit should show correct balance calculations
    expect(result.success).toBe(true);

    const auditRecord = mockDB.getLatestAuditRecord();
    const calculatedBalance =
      auditRecord.total_tokens_purchased - auditRecord.total_tokens_used;

    expect(auditRecord.tokens_forfeited).toBe(1000);
    expect(calculatedBalance).toBe(1000);
  });
});
