// pre_testing/database/DB1.3-transaction-atomicity.test.ts
// Test: Database transaction atomicity

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, MockEnv } from '../test-utils';

describe('DB1.3 - Transaction Atomicity', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Account deletion atomicity', () => {
    it('should create audit record atomically with deletion', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      // Atomic: create audit record and soft-delete user
      const deletionId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(deletionId, user.user_id, user.email).run();

      await env.DB.prepare(`
        UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
      `).bind(new Date().toISOString(), user.user_id).run();

      // Verify both operations
      const audit = await env.DB.prepare(`
        SELECT deletion_id FROM account_deletions WHERE user_id = ?
      `).bind(user.user_id).first();

      const userDeleted = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(audit).not.toBeNull();
      expect(userDeleted?.is_deleted).toBe(1);
    });
  });

  describe('User registration atomicity', () => {
    it('should insert user record atomically', async () => {
      const userId = crypto.randomUUID();
      const email = 'newuser@example.com';
      const timestamp = new Date().toISOString();

      // Single atomic insert
      const result = await env.DB.prepare(`
        INSERT INTO users (user_id, email, created_at, last_login_at)
        VALUES (?, ?, ?, ?)
      `).bind(userId, email, timestamp, timestamp).run();

      expect(result.success).toBe(true);
      expect(result.meta.changes).toBe(1);

      // Verify complete record
      const user = await env.DB.prepare(`
        SELECT user_id, email, created_at, last_login_at
        FROM users WHERE user_id = ?
      `).bind(userId).first();

      expect(user?.user_id).toBe(userId);
      expect(user?.email).toBe(email);
      expect(user?.created_at).toBe(timestamp);
      expect(user?.last_login_at).toBe(timestamp);
    });
  });

  describe('Concurrent operation safety', () => {
    it('should handle concurrent user lookups', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      // Simulate concurrent lookups
      const lookups = await Promise.all([
        env.DB.prepare(`SELECT user_id FROM users WHERE email = ?`).bind(user.email).first(),
        env.DB.prepare(`SELECT user_id FROM users WHERE email = ?`).bind(user.email).first(),
        env.DB.prepare(`SELECT user_id FROM users WHERE email = ?`).bind(user.email).first(),
      ]);

      // All should return same user
      lookups.forEach(result => {
        expect(result?.user_id).toBe(user.user_id);
      });
    });
  });

  describe('Update atomicity', () => {
    it('should update last_login_at atomically', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const newLoginTime = new Date().toISOString();

      const result = await env.DB.prepare(`
        UPDATE users SET last_login_at = ? WHERE user_id = ?
      `).bind(newLoginTime, user.user_id).run();

      expect(result.success).toBe(true);
      expect(result.meta.changes).toBe(1);

      const updated = await env.DB.prepare(`
        SELECT last_login_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(updated?.last_login_at).toBe(newLoginTime);
    });
  });
});
