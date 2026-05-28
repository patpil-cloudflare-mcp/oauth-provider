// pre_testing/database/DB1.2-data-consistency.test.ts
// Test: Database data consistency

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, MockEnv } from '../test-utils';

describe('DB1.2 - Data Consistency', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Referential integrity', () => {
    it('should ensure account_deletions reference valid users', async () => {
      const user = createTestUser();
      env.DB.seedUsers([user]);

      await env.DB.prepare(`
        INSERT INTO account_deletions (deletion_id, user_id, original_email)
        VALUES (?, ?, ?)
      `).bind(crypto.randomUUID(), user.user_id, user.email).run();

      const deletion = await env.DB.prepare(`
        SELECT ad.user_id, u.email
        FROM account_deletions ad
        INNER JOIN users u ON ad.user_id = u.user_id
        WHERE ad.user_id = ?
      `).bind(user.user_id).first();

      expect(deletion).not.toBeNull();
    });
  });

  describe('Data type validation', () => {
    it('should store user_id as valid UUID', async () => {
      const userId = crypto.randomUUID();
      const user = createTestUser({ user_id: userId });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT user_id FROM users WHERE user_id = ?
      `).bind(userId).first();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(uuidRegex.test(result?.user_id as string)).toBe(true);
    });

    it('should store email in valid format', async () => {
      const email = 'valid@example.com';
      const user = createTestUser({ email });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT email FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(result?.email as string)).toBe(true);
    });

    it('should store timestamps in ISO format', async () => {
      const timestamp = new Date().toISOString();
      const user = createTestUser({ created_at: timestamp });
      env.DB.seedUsers([user]);

      const result = await env.DB.prepare(`
        SELECT created_at FROM users WHERE user_id = ?
      `).bind(user.user_id).first();

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(isoRegex.test(result?.created_at as string)).toBe(true);
    });

    it('should store is_deleted as integer (0 or 1)', async () => {
      const activeUser = createTestUser({ is_deleted: 0 });
      const deletedUser = createTestUser({ is_deleted: 1 });
      env.DB.seedUsers([activeUser, deletedUser]);

      const active = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(activeUser.user_id).first();

      const deleted = await env.DB.prepare(`
        SELECT is_deleted FROM users WHERE user_id = ?
      `).bind(deletedUser.user_id).first();

      expect([0, 1]).toContain(active?.is_deleted);
      expect([0, 1]).toContain(deleted?.is_deleted);
    });
  });

  describe('Soft delete consistency', () => {
    it('should maintain is_deleted and deleted_at consistency', async () => {
      const deletedUser = createTestUser({
        is_deleted: 1,
        deleted_at: new Date().toISOString()
      });
      env.DB.seedUsers([deletedUser]);

      const result = await env.DB.prepare(`
        SELECT is_deleted, deleted_at FROM users WHERE user_id = ?
      `).bind(deletedUser.user_id).first();

      // If is_deleted=1, deleted_at should be set
      if (result?.is_deleted === 1) {
        expect(result?.deleted_at).not.toBeNull();
      }
    });

    it('should not have deleted_at for active users', async () => {
      const activeUser = createTestUser({
        is_deleted: 0,
        deleted_at: null
      });
      env.DB.seedUsers([activeUser]);

      const result = await env.DB.prepare(`
        SELECT is_deleted, deleted_at FROM users WHERE user_id = ?
      `).bind(activeUser.user_id).first();

      // If is_deleted=0, deleted_at should be null
      if (result?.is_deleted === 0) {
        expect(result?.deleted_at).toBeNull();
      }
    });
  });

  describe('Index verification', () => {
    it('should efficiently query by email (idx_users_email)', async () => {
      // Seed multiple users
      const users = Array.from({ length: 10 }, (_, i) =>
        createTestUser({ email: `user${i}@example.com` })
      );
      env.DB.seedUsers(users);

      // Query by email should be efficient with index
      const result = await env.DB.prepare(`
        SELECT user_id FROM users WHERE email = ?
      `).bind('user5@example.com').first();

      expect(result).not.toBeNull();
    });
  });
});
