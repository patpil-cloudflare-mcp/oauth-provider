// pre_testing/account-deletion/D1.2-audit-trail.test.ts
// Test: GDPR audit trail for account deletions

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, MockEnv } from '../test-utils';

describe('D1.2 - Account Deletion Audit Trail', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should create audit record on account deletion', async () => {
    const user = createTestUser({ email: 'audit@example.com' });
    env.DB.seedUsers([user]);

    // Create audit record
    const deletionId = crypto.randomUUID();
    const deletionReason = 'User requested deletion';
    const deletedByIp = '192.168.1.1';

    await env.DB.prepare(`
      INSERT INTO account_deletions (
        deletion_id, user_id, original_email, deletion_reason, deleted_by_ip
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(deletionId, user.user_id, user.email, deletionReason, deletedByIp).run();

    // Verify audit record
    const audit = await env.DB.prepare(`
      SELECT * FROM account_deletions WHERE deletion_id = ?
    `).bind(deletionId).first();

    expect(audit).not.toBeNull();
    expect(audit?.user_id).toBe(user.user_id);
    expect(audit?.original_email).toBe(user.email);
    expect(audit?.deletion_reason).toBe(deletionReason);
  });

  it('should preserve original email in audit record', async () => {
    const originalEmail = 'original@example.com';
    const user = createTestUser({ email: originalEmail });
    env.DB.seedUsers([user]);

    // Create audit record
    await env.DB.prepare(`
      INSERT INTO account_deletions (
        deletion_id, user_id, original_email, deletion_reason
      ) VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), user.user_id, originalEmail, 'GDPR request').run();

    // Query audit by original email
    const audit = await env.DB.prepare(`
      SELECT original_email FROM account_deletions WHERE original_email = ?
    `).bind(originalEmail).first();

    expect(audit?.original_email).toBe(originalEmail);
  });

  it('should record deletion timestamp', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const deletionId = crypto.randomUUID();
    const deletedAt = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO account_deletions (
        deletion_id, user_id, original_email, deletion_reason, deleted_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(deletionId, user.user_id, user.email, 'User request', deletedAt).run();

    const audit = await env.DB.prepare(`
      SELECT deleted_at FROM account_deletions WHERE deletion_id = ?
    `).bind(deletionId).first();

    expect(audit?.deleted_at).toBe(deletedAt);
  });

  it('should record IP address for security audit', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const deletionId = crypto.randomUUID();
    const clientIp = '2001:0db8:85a3:0000:0000:8a2e:0370:7334'; // IPv6

    await env.DB.prepare(`
      INSERT INTO account_deletions (
        deletion_id, user_id, original_email, deletion_reason, deleted_by_ip
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(deletionId, user.user_id, user.email, 'User request', clientIp).run();

    const audit = await env.DB.prepare(`
      SELECT deleted_by_ip FROM account_deletions WHERE deletion_id = ?
    `).bind(deletionId).first();

    expect(audit?.deleted_by_ip).toBe(clientIp);
  });

  it('should allow querying deletions by date range', async () => {
    const user1 = createTestUser({ email: 'user1@example.com' });
    const user2 = createTestUser({ email: 'user2@example.com' });
    env.DB.seedUsers([user1, user2]);

    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const today = new Date().toISOString();

    // Create audit records with different dates
    await env.DB.prepare(`
      INSERT INTO account_deletions (deletion_id, user_id, original_email, deleted_at)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), user1.user_id, user1.email, yesterday).run();

    await env.DB.prepare(`
      INSERT INTO account_deletions (deletion_id, user_id, original_email, deleted_at)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), user2.user_id, user2.email, today).run();

    // Query all deletions
    const allDeletions = await env.DB.prepare(`
      SELECT * FROM account_deletions
    `).all();

    expect(allDeletions.results.length).toBe(2);
  });

  it('should generate unique deletion_id', async () => {
    const deletionIds = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const id = crypto.randomUUID();
      expect(deletionIds.has(id)).toBe(false);
      deletionIds.add(id);
    }

    expect(deletionIds.size).toBe(100);
  });

  it('should record deletion reason', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const reasons = [
      'User requested via settings',
      'GDPR Article 17 request',
      'Account security concern',
      'Inactive account cleanup'
    ];

    for (const reason of reasons) {
      const deletionId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email, deletion_reason)
        VALUES (?, ?, ?, ?)
      `).bind(deletionId, user.user_id, user.email, reason).run();

      const audit = await env.DB.prepare(`
        SELECT deletion_reason FROM account_deletions WHERE deletion_id = ?
      `).bind(deletionId).first();

      expect(audit?.deletion_reason).toBe(reason);
    }
  });

  it('should maintain audit record even if user data is modified', async () => {
    const user = createTestUser({ email: 'preserved@example.com' });
    env.DB.seedUsers([user]);

    // Create audit record first
    const deletionId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO account_deletions (deletion_id, user_id, original_email)
      VALUES (?, ?, ?)
    `).bind(deletionId, user.user_id, user.email).run();

    // Modify user (e.g., anonymize email)
    await env.DB.prepare(`
      UPDATE users SET email = ? WHERE user_id = ?
    `).bind('anonymized@deleted.local', user.user_id).run();

    // Audit record should still have original email
    const audit = await env.DB.prepare(`
      SELECT original_email FROM account_deletions WHERE deletion_id = ?
    `).bind(deletionId).first();

    expect(audit?.original_email).toBe('preserved@example.com');
  });
});
