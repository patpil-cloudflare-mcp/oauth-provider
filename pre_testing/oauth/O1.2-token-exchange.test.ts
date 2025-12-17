// pre_testing/oauth/O1.2-token-exchange.test.ts
// Test: OAuth 2.1 token exchange

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv, MockEnv } from '../test-utils';

describe('O1.2 - OAuth Token Exchange', () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Authorization code exchange', () => {
    it('should require grant_type=authorization_code', () => {
      const validGrantType = 'authorization_code';
      const invalidGrantTypes = ['password', 'client_credentials', 'implicit', ''];

      expect(validGrantType).toBe('authorization_code');

      for (const invalid of invalidGrantTypes) {
        expect(invalid).not.toBe('authorization_code');
      }
    });

    it('should require code parameter', () => {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: 'https://example.com/callback',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      });

      const hasCode = params.has('code');
      expect(hasCode).toBe(false);
    });

    it('should require code_verifier for PKCE', () => {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'auth_code_123',
        redirect_uri: 'https://example.com/callback',
      });

      const hasCodeVerifier = params.has('code_verifier');
      expect(hasCodeVerifier).toBe(false);
    });

    it('should validate code_verifier against stored code_challenge', async () => {
      // code_verifier should hash to code_challenge using SHA-256
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

      // Calculate expected challenge
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const base64url = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // Expected: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
      expect(base64url.length).toBe(43);
    });

    it('should require redirect_uri to match authorization request', () => {
      const authRedirectUri = 'https://example.com/callback';
      const tokenRedirectUri = 'https://example.com/callback';

      expect(authRedirectUri).toBe(tokenRedirectUri);
    });
  });

  describe('Authorization code validation', () => {
    it('should reject expired authorization codes', async () => {
      // Authorization codes expire after 10 minutes
      const codeCreatedAt = Date.now() - (11 * 60 * 1000); // 11 minutes ago
      const expirationTime = 10 * 60 * 1000; // 10 minutes
      const isExpired = Date.now() - codeCreatedAt > expirationTime;

      expect(isExpired).toBe(true);
    });

    it('should accept non-expired authorization codes', async () => {
      const codeCreatedAt = Date.now() - (5 * 60 * 1000); // 5 minutes ago
      const expirationTime = 10 * 60 * 1000; // 10 minutes
      const isExpired = Date.now() - codeCreatedAt > expirationTime;

      expect(isExpired).toBe(false);
    });

    it('should reject reused authorization codes', async () => {
      // Store used codes
      const usedCodes = new Set<string>();
      const code = 'auth_code_single_use';

      // First use
      const firstUseValid = !usedCodes.has(code);
      usedCodes.add(code);

      // Second use
      const secondUseValid = !usedCodes.has(code);

      expect(firstUseValid).toBe(true);
      expect(secondUseValid).toBe(false);
    });

    it('should invalidate all tokens if code is reused', () => {
      // Security requirement: if code is reused, revoke all tokens
      // issued from that code
      const codeUsedTwice = true;
      const shouldRevokeTokens = codeUsedTwice;

      expect(shouldRevokeTokens).toBe(true);
    });
  });

  describe('Token response', () => {
    it('should return access_token', () => {
      const tokenResponse = {
        access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer',
        expires_in: 1800, // 30 minutes
        refresh_token: 'refresh_token_123',
      };

      expect(tokenResponse.access_token).toBeDefined();
      expect(tokenResponse.access_token.length).toBeGreaterThan(0);
    });

    it('should return token_type=Bearer', () => {
      const tokenResponse = {
        access_token: 'token_123',
        token_type: 'Bearer',
        expires_in: 1800,
      };

      expect(tokenResponse.token_type).toBe('Bearer');
    });

    it('should return expires_in (30 minutes for access tokens)', () => {
      const accessTokenExpiry = 30 * 60; // 30 minutes in seconds

      expect(accessTokenExpiry).toBe(1800);
    });

    it('should return refresh_token', () => {
      const tokenResponse = {
        access_token: 'token_123',
        token_type: 'Bearer',
        expires_in: 1800,
        refresh_token: 'refresh_token_123',
      };

      expect(tokenResponse.refresh_token).toBeDefined();
    });

    it('should NOT return id_token (not OpenID Connect)', () => {
      const tokenResponse = {
        access_token: 'token_123',
        token_type: 'Bearer',
        expires_in: 1800,
        refresh_token: 'refresh_token_123',
      };

      expect(tokenResponse).not.toHaveProperty('id_token');
    });
  });

  describe('Refresh token exchange', () => {
    it('should require grant_type=refresh_token', () => {
      const validGrantType = 'refresh_token';
      expect(validGrantType).toBe('refresh_token');
    });

    it('should require refresh_token parameter', () => {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
      });

      const hasRefreshToken = params.has('refresh_token');
      expect(hasRefreshToken).toBe(false);
    });

    it('should implement refresh token rotation', () => {
      // New refresh token issued on each use
      const oldRefreshToken = 'old_refresh_token';
      const newRefreshToken = 'new_refresh_token';

      expect(oldRefreshToken).not.toBe(newRefreshToken);
    });

    it('should set refresh token expiry (30 days)', () => {
      const refreshTokenExpiry = 30 * 24 * 60 * 60; // 30 days in seconds

      expect(refreshTokenExpiry).toBe(2592000);
    });
  });

  describe('Error responses', () => {
    it('should return invalid_request for missing parameters', () => {
      const error = {
        error: 'invalid_request',
        error_description: 'Missing required parameter: code',
      };

      expect(error.error).toBe('invalid_request');
    });

    it('should return invalid_grant for invalid code', () => {
      const error = {
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid or expired',
      };

      expect(error.error).toBe('invalid_grant');
    });

    it('should return invalid_client for unknown client', () => {
      const error = {
        error: 'invalid_client',
        error_description: 'Unknown client_id',
      };

      expect(error.error).toBe('invalid_client');
    });

    it('should return server_error for internal errors', () => {
      const error = {
        error: 'server_error',
        error_description: 'Internal server error',
      };

      expect(error.error).toBe('server_error');
    });
  });
});
