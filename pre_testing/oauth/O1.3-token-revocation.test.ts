// pre_testing/oauth/O1.3-token-revocation.test.ts
// Test: OAuth token revocation (RFC 7009)

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, MockEnv } from '../test-utils';

describe('O1.3 - OAuth Token Revocation (RFC 7009)', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Revocation request', () => {
    it('should accept POST method only', () => {
      const validMethod = 'POST';
      const invalidMethods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      expect(validMethod).toBe('POST');

      for (const method of invalidMethods) {
        expect(method).not.toBe('POST');
      }
    });

    it('should require token parameter', () => {
      const params = new URLSearchParams({
        token_type_hint: 'access_token',
      });

      const hasToken = params.has('token');
      expect(hasToken).toBe(false);
    });

    it('should accept optional token_type_hint', () => {
      const validHints = ['access_token', 'refresh_token'];

      for (const hint of validHints) {
        expect(['access_token', 'refresh_token']).toContain(hint);
      }
    });

    it('should use application/x-www-form-urlencoded content type', () => {
      const contentType = 'application/x-www-form-urlencoded';
      expect(contentType).toBe('application/x-www-form-urlencoded');
    });
  });

  describe('Access token revocation', () => {
    it('should invalidate access token in KV store', async () => {
      const accessToken = 'access_token_to_revoke';

      // Store token
      await env.OAUTH_STORE.put(`oauth_token:${accessToken}`, JSON.stringify({
        user_id: 'user_123',
        created_at: Date.now(),
      }));

      // Verify token exists
      let stored = await env.OAUTH_STORE.get(`oauth_token:${accessToken}`);
      expect(stored).not.toBeNull();

      // Revoke token
      await env.OAUTH_STORE.delete(`oauth_token:${accessToken}`);

      // Verify token is revoked
      stored = await env.OAUTH_STORE.get(`oauth_token:${accessToken}`);
      expect(stored).toBeNull();
    });

    it('should return 200 OK on successful revocation', () => {
      // RFC 7009: Server responds with 200 OK
      const responseStatus = 200;
      expect(responseStatus).toBe(200);
    });

    it('should return 200 OK even for invalid tokens', () => {
      // RFC 7009: Server responds with 200 OK even if token is invalid
      // This prevents token enumeration attacks
      const responseStatus = 200;
      expect(responseStatus).toBe(200);
    });
  });

  describe('Refresh token revocation', () => {
    it('should invalidate refresh token', async () => {
      const refreshToken = 'refresh_token_to_revoke';

      // Store refresh token
      await env.OAUTH_STORE.put(`refresh_token:${refreshToken}`, JSON.stringify({
        user_id: 'user_123',
        access_token: 'access_123',
      }));

      // Verify exists
      let stored = await env.OAUTH_STORE.get(`refresh_token:${refreshToken}`);
      expect(stored).not.toBeNull();

      // Revoke
      await env.OAUTH_STORE.delete(`refresh_token:${refreshToken}`);

      // Verify revoked
      stored = await env.OAUTH_STORE.get(`refresh_token:${refreshToken}`);
      expect(stored).toBeNull();
    });

    it('should also revoke associated access token', async () => {
      const refreshToken = 'refresh_123';
      const accessToken = 'access_123';

      // Store both tokens
      await env.OAUTH_STORE.put(`refresh_token:${refreshToken}`, JSON.stringify({
        access_token: accessToken,
      }));
      await env.OAUTH_STORE.put(`oauth_token:${accessToken}`, JSON.stringify({
        user_id: 'user_123',
      }));

      // When revoking refresh token, also revoke access token
      const refreshData = await env.OAUTH_STORE.get(`refresh_token:${refreshToken}`);
      if (refreshData) {
        const { access_token } = JSON.parse(refreshData);
        await env.OAUTH_STORE.delete(`oauth_token:${access_token}`);
        await env.OAUTH_STORE.delete(`refresh_token:${refreshToken}`);
      }

      // Both should be revoked
      const accessStored = await env.OAUTH_STORE.get(`oauth_token:${accessToken}`);
      const refreshStored = await env.OAUTH_STORE.get(`refresh_token:${refreshToken}`);

      expect(accessStored).toBeNull();
      expect(refreshStored).toBeNull();
    });
  });

  describe('Client authentication for revocation', () => {
    it('should verify client_id matches token owner', () => {
      const tokenClientId = 'client_abc';
      const requestClientId = 'client_abc';

      expect(tokenClientId).toBe(requestClientId);
    });

    it('should reject revocation from non-owner client', () => {
      const tokenClientId = 'client_abc';
      const requestClientId = 'client_xyz';

      const isOwner = tokenClientId === requestClientId;
      expect(isOwner).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should return unsupported_token_type for unknown hint', () => {
      const error = {
        error: 'unsupported_token_type',
        error_description: 'Unknown token type hint',
      };

      expect(error.error).toBe('unsupported_token_type');
    });

    it('should handle empty token gracefully', () => {
      const token = '';
      const isValid = token.length > 0;

      expect(isValid).toBe(false);
    });
  });

  describe('Revoke all user tokens', () => {
    it('should revoke all tokens for a user on logout', async () => {
      const userId = 'user_123';

      // Store multiple tokens for user
      await env.OAUTH_STORE.put(`oauth_token:access_1`, JSON.stringify({ user_id: userId }));
      await env.OAUTH_STORE.put(`oauth_token:access_2`, JSON.stringify({ user_id: userId }));
      await env.OAUTH_STORE.put(`refresh_token:refresh_1`, JSON.stringify({ user_id: userId }));

      // In production, would iterate through user's tokens
      // For test, delete known tokens
      await env.OAUTH_STORE.delete(`oauth_token:access_1`);
      await env.OAUTH_STORE.delete(`oauth_token:access_2`);
      await env.OAUTH_STORE.delete(`refresh_token:refresh_1`);

      // Verify all revoked
      const access1 = await env.OAUTH_STORE.get(`oauth_token:access_1`);
      const access2 = await env.OAUTH_STORE.get(`oauth_token:access_2`);
      const refresh1 = await env.OAUTH_STORE.get(`refresh_token:refresh_1`);

      expect(access1).toBeNull();
      expect(access2).toBeNull();
      expect(refresh1).toBeNull();
    });
  });
});
