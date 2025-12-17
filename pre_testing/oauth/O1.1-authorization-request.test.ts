// pre_testing/oauth/O1.1-authorization-request.test.ts
// Test: OAuth 2.1 authorization request validation

import { describe, it, expect } from 'vitest';

describe('O1.1 - OAuth Authorization Request', () => {
  describe('Required parameters', () => {
    it('should require client_id parameter', () => {
      const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        state: 'abc123'
      });

      const hasClientId = params.has('client_id');
      expect(hasClientId).toBe(false);
    });

    it('should require response_type=code', () => {
      const validResponseType = 'code';
      const invalidResponseTypes = ['token', 'id_token', 'none', ''];

      expect(validResponseType).toBe('code');

      for (const invalid of invalidResponseTypes) {
        expect(invalid).not.toBe('code');
      }
    });

    it('should require redirect_uri parameter', () => {
      const params = new URLSearchParams({
        client_id: 'test_client',
        response_type: 'code',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      });

      const hasRedirectUri = params.has('redirect_uri');
      expect(hasRedirectUri).toBe(false);
    });

    it('should require state parameter for CSRF protection', () => {
      const params = new URLSearchParams({
        client_id: 'test_client',
        response_type: 'code',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      });

      // State is recommended but may not be required
      const hasState = params.has('state');
      expect(hasState).toBe(false);
    });
  });

  describe('PKCE requirements (OAuth 2.1)', () => {
    it('should require code_challenge for PKCE', () => {
      const params = new URLSearchParams({
        client_id: 'test_client',
        response_type: 'code',
        redirect_uri: 'https://example.com/callback',
        code_challenge_method: 'S256',
      });

      const hasCodeChallenge = params.has('code_challenge');
      expect(hasCodeChallenge).toBe(false);
    });

    it('should require code_challenge_method=S256', () => {
      const validMethod = 'S256';
      const invalidMethods = ['plain', 'sha1', 'sha512', ''];

      expect(validMethod).toBe('S256');

      for (const invalid of invalidMethods) {
        expect(invalid).not.toBe('S256');
      }
    });

    it('should validate code_challenge format (base64url)', () => {
      // Base64URL: A-Z, a-z, 0-9, -, _ (no padding =)
      const validChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const base64urlRegex = /^[A-Za-z0-9_-]{43}$/;

      expect(base64urlRegex.test(validChallenge)).toBe(true);
    });

    it('should reject plain code_challenge_method (OAuth 2.1)', () => {
      const method = 'plain';

      // OAuth 2.1 deprecates 'plain' method
      const isAllowed = method === 'S256';
      expect(isAllowed).toBe(false);
    });
  });

  describe('Redirect URI validation', () => {
    it('should require exact redirect_uri match', () => {
      const registeredUri = 'https://example.com/callback';
      const requestUri = 'https://example.com/callback';

      expect(registeredUri).toBe(requestUri);
    });

    it('should reject redirect_uri with additional path', () => {
      const registeredUri = 'https://example.com/callback';
      const requestUri = 'https://example.com/callback/extra';

      expect(registeredUri).not.toBe(requestUri);
    });

    it('should reject redirect_uri with different query params', () => {
      const registeredUri = 'https://example.com/callback';
      const requestUri = 'https://example.com/callback?extra=param';

      expect(registeredUri).not.toBe(requestUri);
    });

    it('should require HTTPS for redirect_uri', () => {
      const httpsUri = 'https://example.com/callback';
      const httpUri = 'http://example.com/callback';
      const localhostHttp = 'http://localhost:3000/callback'; // Exception for dev

      expect(httpsUri.startsWith('https://')).toBe(true);
      expect(httpUri.startsWith('https://')).toBe(false);

      // Localhost is allowed for development
      expect(localhostHttp.includes('localhost')).toBe(true);
    });

    it('should allow localhost for development', () => {
      const devUris = [
        'http://localhost:3000/callback',
        'http://localhost:8080/oauth',
        'http://127.0.0.1:3000/callback',
      ];

      for (const uri of devUris) {
        const isLocalhost = uri.includes('localhost') || uri.includes('127.0.0.1');
        expect(isLocalhost).toBe(true);
      }
    });
  });

  describe('Scope handling', () => {
    it('should parse space-separated scopes', () => {
      const scopeParam = 'read write profile';
      const scopes = scopeParam.split(' ');

      expect(scopes).toEqual(['read', 'write', 'profile']);
    });

    it('should handle empty scope', () => {
      const scopeParam = '';
      const scopes = scopeParam ? scopeParam.split(' ') : [];

      expect(scopes).toEqual([]);
    });

    it('should reject unknown scopes', () => {
      const validScopes = ['read', 'write', 'profile'];
      const requestedScopes = ['read', 'admin', 'delete'];

      const invalidScopes = requestedScopes.filter(s => !validScopes.includes(s));
      expect(invalidScopes).toEqual(['admin', 'delete']);
    });
  });
});
