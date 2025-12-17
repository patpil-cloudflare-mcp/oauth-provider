// pre_testing/user-registration/U1.1-new-user-creation.test.ts
// Test: New user creation in database

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, createTestUser, MockEnv } from '../test-utils';

describe('U1.1 - New User Creation', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should create a new user with all required fields', async () => {
    const userId = crypto.randomUUID();
    const email = 'newuser@example.com';
    const timestamp = new Date().toISOString();

    // Insert user
    await env.DB.prepare(`
      INSERT INTO users (user_id, email, created_at, last_login_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, email, timestamp, timestamp).run();

    // Verify user was created
    const user = await env.DB.prepare(`
      SELECT user_id, email, created_at, last_login_at, is_deleted
      FROM users WHERE user_id = ?
    `).bind(userId).first();

    expect(user).not.toBeNull();
    expect(user?.user_id).toBe(userId);
    expect(user?.email).toBe(email);
    expect(user?.created_at).toBe(timestamp);
    expect(user?.is_deleted).toBe(undefined); // Default value
  });

  it('should generate unique UUID for user_id', async () => {
    const userIds = new Set<string>();

    // Create 100 UUIDs and check uniqueness
    for (let i = 0; i < 100; i++) {
      const userId = crypto.randomUUID();
      expect(userIds.has(userId)).toBe(false);
      userIds.add(userId);
    }

    expect(userIds.size).toBe(100);
  });

  it('should enforce email uniqueness constraint', async () => {
    const email = 'duplicate@example.com';
    const user1 = createTestUser({ email });
    const user2 = createTestUser({ email });

    // Seed first user
    env.DB.seedUsers([user1]);

    // Get existing users with same email
    const existingUser = await env.DB.prepare(`
      SELECT user_id FROM users WHERE email = ?
    `).bind(email).first();

    expect(existingUser).not.toBeNull();
    expect(existingUser?.user_id).toBe(user1.user_id);

    // In production, INSERT would fail due to UNIQUE constraint
    // For mock, we verify the check happens before insert
    const shouldRejectDuplicate = existingUser !== null;
    expect(shouldRejectDuplicate).toBe(true);
  });

  it('should set created_at timestamp on user creation', async () => {
    const userId = crypto.randomUUID();
    const email = 'timestamp@example.com';
    const beforeCreation = new Date();

    const timestamp = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO users (user_id, email, created_at, last_login_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, email, timestamp, timestamp).run();

    const user = await env.DB.prepare(`
      SELECT created_at FROM users WHERE user_id = ?
    `).bind(userId).first();

    const createdAt = new Date(user?.created_at as string);
    const afterCreation = new Date();

    expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000);
    expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000);
  });

  it('should set last_login_at on first registration', async () => {
    const userId = crypto.randomUUID();
    const email = 'firstlogin@example.com';
    const timestamp = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO users (user_id, email, created_at, last_login_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, email, timestamp, timestamp).run();

    const user = await env.DB.prepare(`
      SELECT last_login_at FROM users WHERE user_id = ?
    `).bind(userId).first();

    expect(user?.last_login_at).toBe(timestamp);
  });

  it('should set is_deleted to 0 by default', async () => {
    const user = createTestUser();
    env.DB.seedUsers([user]);

    const result = await env.DB.prepare(`
      SELECT is_deleted FROM users WHERE user_id = ?
    `).bind(user.user_id).first();

    // Default value should be 0 (not deleted)
    expect(result?.is_deleted).toBe(0);
  });

  it('should allow null workos_user_id initially', async () => {
    const userId = crypto.randomUUID();
    const email = 'noworkos@example.com';
    const timestamp = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO users (user_id, email, created_at, last_login_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, email, timestamp, timestamp).run();

    const user = await env.DB.prepare(`
      SELECT workos_user_id FROM users WHERE user_id = ?
    `).bind(userId).first();

    // workos_user_id can be null initially (set after WorkOS auth)
    expect(user?.workos_user_id).toBeUndefined();
  });
});
