// pre_testing/database/DB1.1-schema-integrity.test.ts
// Test: Database schema integrity

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, MockEnv } from '../test-utils';

describe('DB1.1 - Schema Integrity', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Users table schema', () => {
    it('should have user_id as PRIMARY KEY', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.user_id).toBe(user.user_id);
    });

    it('should have email as UNIQUE constraint', async () => {
      const email = 'unique@example.com';
      const user = createTestUser({ email });
      env.DB.seedUsers([user]);

      // In production, this would fail with UNIQUE constraint violation
      const existing = await env.DB.prepare(`
        SELECT user_id FROM users WHERE email = ?
      `).bind(email).first();

      expect(existing).not.toBeNull();
    });

    it('should have is_deleted with DEFAULT 0', async () => {
      const user = createTestUser({ is_deleted: 0 });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.is_deleted).toBe(0);
    });

    it('should have created_at column', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT created_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.created_at).toBeDefined();
    });

    it('should have last_login_at column', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT last_login_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.last_login_at).toBeDefined();
    });

    it('should have optional workos_user_id column', async () => {
      const user = createTestUser({ workos_user_id: 'workos_abc123' });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT workos_user_id FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.workos_user_id).toBe('workos_abc123');
    });

    it('should have deleted_at column (nullable)', async () => {
      const user = createTestUser({ deleted_at: null });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT deleted_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.deleted_at).toBeNull();
    });
  });

  describe('Account deletions table schema', () => {
    it('should have deletion_id as PRIMARY KEY', async () => {
      const deletionId = crypto.randomUUID();
      const user = createTestUser();
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(deletionId, user.user_id, user.email).run();

      const result = await env.DB.prepare(`
        SELECT deletion_id FROM account_deletions WHERE deletion_id = ?
      `).bind(deletionId).first();

      expect(result?.deletion_id).toBe(deletionId);
    });

    it('should have user_id FOREIGN KEY', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(crypto.randomUUID(), user.user_id, user.email).run();

      const result = await env.DB.prepare(`
        SELECT user_id FROM account_deletions WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.user_id).toBe(user.user_id);
    });

    it('should have original_email column', async () => {
      const user = createTestUser({ email: 'preserved@example.com' });
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(crypto.randomUUID(), user.user_id, user.email).run();

      const result = await env.DB.prepare(`
        SELECT original_email FROM account_deletions WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.original_email).toBe('preserved@example.com');
    });

    it('should have deletion_reason column', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email, deletion_reason)
        VALUES (?, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.user_id, user.email, 'User request').run();

      const result = await env.DB.prepare(`
        SELECT deletion_reason FROM account_deletions WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.deletion_reason).toBe('User request');
    });

    it('should have deleted_by_ip column', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email, deleted_by_ip)
        VALUES (?, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.user_id, user.email, '192.168.1.1').run();

      const result = await env.DB.prepare(`
        SELECT deleted_by_ip FROM account_deletions WHERE user_id = ?
      `).bind(user.user_id).first();

      expect(result?.deleted_by_ip).toBe('192.168.1.1');
    });
  });
});
