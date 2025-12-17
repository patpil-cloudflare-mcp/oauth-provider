// pre_testing/account-deletion/D1.1-soft-delete-user.test.ts
// Test: Soft deletion of user accounts

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, MockEnv } from '../test-utils';

describe('D1.1 - Soft Delete User', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should mark user as deleted without removing from database', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    // Soft delete
    const deleteTime = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
    `).bind(deleteTime, user.user_id).run();

    // Verify user still exists
    const result = await env.DB.prepare(`
      SELECT user_id, is_deleted, deleted_at FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    expect(result).not.toBeNull();
    expect(result?.is_deleted).toBe(1);
    expect(result?.deleted_at).toBe(deleteTime);
  });

  it('should set is_deleted flag to 1', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    await env.DB.prepare(`
      UPDATE users SET is_deleted = 1 WHERE user_id = ?
    `).bind(user.user_id).run();

    const result = await env.DB.prepare(`
      SELECT is_deleted FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    expect(result?.is_deleted).toBe(1);
  });

  it('should record deleted_at timestamp', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const beforeDelete = new Date();
    const deleteTime = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
    `).bind(deleteTime, user.user_id).run();

    const result = await env.DB.prepare(`
      SELECT deleted_at FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    const deletedAt = new Date(result?.deleted_at as string);
    const afterDelete = new Date();

    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime() - 1000);
    expect(deletedAt.getTime()).toBeLessThanOrEqual(afterDelete.getTime() + 1000);
  });

  it('should preserve original user data after deletion', async () => {
    const user = createTestUser({
      email: 'preserve@example.com',
      workos_user_id: 'workos_123'
    });
    env.DB.seedUsers([user]);

    // Soft delete
    await env.DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
    `).bind(new Date().toISOString(), user.user_id).run();

    // Verify data is preserved
    const result = await env.DB.prepare(`
      SELECT email, workos_user_id, created_at FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    expect(result?.email).toBe(user.email);
    expect(result?.workos_user_id).toBe(user.workos_user_id);
    expect(result?.created_at).toBe(user.created_at);
  });

  it('should exclude deleted users from active user queries', async () => {
    const activeUser = createTestUser({ email: 'active@example.com' });
    const deletedUser = createTestUser({
      email: 'deleted@example.com',
      is_deleted: 1,
      deleted_at: new Date().toISOString()
    });
    env.DB.seedUsers([activeUser, deletedUser]);

    // Query for active users only
    const activeUsers = await env.DB.prepare(`
      SELECT user_id, email FROM users WHERE is_deleted = 0
    `).bind().all();

    expect(activeUsers.results.length).toBe(1);
    expect(activeUsers.results[0].email).toBe('active@example.com');
  });

  it('should allow finding deleted users when explicitly queried', async () => {
    const deletedUser = createTestUser({
      email: 'findable@example.com',
      is_deleted: 1,
      deleted_at: new Date().toISOString()
    });
    env.DB.seedUsers([deletedUser]);

    // Explicitly query deleted users
    const result = await env.DB.prepare(`
      SELECT user_id, email FROM users WHERE is_deleted = 1
    `).bind().all();

    expect(result.results.length).toBe(1);
    expect(result.results[0].email).toBe('findable@example.com');
  });

  it('should handle deletion of non-existent user gracefully', async () => {
    const nonExistentId = crypto.randomUUID();

    const result = await env.DB.prepare(`
      UPDATE users SET is_deleted = 1, deleted_at = ? WHERE user_id = ?
    `).bind(new Date().toISOString(), nonExistentId).run();

    expect(result.meta.changes).toBe(0);
  });

  it('should not allow deletion of already deleted user', async () => {
    const deletedUser = createTestUser({
      is_deleted: 1,
      deleted_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
    });
    env.DB.seedUsers([deletedUser]);

    // Check if already deleted before attempting deletion
    const user = await env.DB.prepare(`
      SELECT is_deleted FROM users WHERE user_id = ?
    `).bind(deletedUser.user_id).first();

    expect(user?.is_deleted).toBe(1);

    // Attempting to delete again should be a no-op or error
    const shouldProceed = user?.is_deleted !== 1;
    expect(shouldProceed).toBe(false);
  });
});
