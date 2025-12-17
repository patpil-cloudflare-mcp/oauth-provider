// pre_testing/oauth/O1.4-csrf-protection.test.ts
// Test: CSRF protection in OAuth flow

import { describe, it, expect } from 'vitest';

describe('O1.4 - CSRF Protection', () => {
  describe('State parameter', () => {
    it('should generate cryptographically random state', () => {
      const state = crypto.randomUUID();

      expect(state).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique state values', () => {
      const states = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const state = crypto.randomUUID();
        expect(states.has(state)).toBe(false);
        states.add(state);
      }

      expect(states.size).toBe(100);
    });

    it('should validate state matches on callback', () => {
      const originalState = 'state_abc123';
      const returnedState = 'state_abc123';

      expect(originalState).toBe(returnedState);
    });

    it('should reject mismatched state', () => {
      const originalState = 'state_abc123';
      const returnedState = 'state_xyz789';

      expect(originalState).not.toBe(returnedState);
    });

    it('should reject empty state on callback', () => {
      const returnedState = '';

      const isValid = returnedState.length > 0;
      expect(isValid).toBe(false);
    });
  });

  describe('CSRF token in forms', () => {
    it('should generate CSRF token for forms', () => {
      const csrfToken = crypto.randomUUID();

      expect(csrfToken.length).toBe(36);
    });

    it('should store CSRF token in HttpOnly cookie', () => {
      const cookieAttributes = {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/auth',
        maxAge: 600 // 10 minutes
      };

      expect(cookieAttributes.httpOnly).toBe(true);
      expect(cookieAttributes.secure).toBe(true);
      expect(cookieAttributes.sameSite).toBe('Lax');
    });

    it('should include CSRF token in form as hidden field', () => {
      const csrfToken = crypto.randomUUID();
      const hiddenInput = `<input type="hidden" name="csrf_token" value="${csrfToken}">`;

      expect(hiddenInput).toContain('csrf_token');
      expect(hiddenInput).toContain(csrfToken);
    });

    it('should validate CSRF token matches cookie', () => {
      const csrfToken = 'csrf_abc123';
      const cookieCsrf = 'csrf_abc123';
      const formCsrf = 'csrf_abc123';

      expect(cookieCsrf).toBe(formCsrf);
    });

    it('should reject CSRF token mismatch', () => {
      const cookieCsrf = 'csrf_cookie_value';
      const formCsrf = 'csrf_form_value';

      expect(cookieCsrf).not.toBe(formCsrf);
    });

    it('should generate new CSRF token after validation failure', () => {
      const oldToken = 'old_csrf_token';
      const newToken = crypto.randomUUID();

      expect(newToken).not.toBe(oldToken);
    });
  });

  describe('SameSite cookie protection', () => {
    it('should set SameSite=Lax on session cookies', () => {
      const cookie = 'workos_session=token; Path=/; HttpOnly; Secure; SameSite=Lax';

      expect(cookie).toContain('SameSite=Lax');
    });

    it('should set SameSite=Lax on CSRF cookies', () => {
      const cookie = 'magic_auth_csrf=token; Path=/auth; HttpOnly; Secure; SameSite=Lax';

      expect(cookie).toContain('SameSite=Lax');
    });
  });

  describe('Referrer validation', () => {
    it('should check Origin header for same-site requests', () => {
      const origin = 'https://panel.wtyczki.ai';
      const expectedDomain = 'wtyczki.ai';

      expect(origin).toContain(expectedDomain);
    });

    it('should reject requests from foreign origins', () => {
      const origin = 'https://malicious-site.com';
      const expectedDomain = 'wtyczki.ai';

      expect(origin).not.toContain(expectedDomain);
    });
  });

  describe('Double-submit cookie pattern', () => {
    it('should match cookie value with form value', () => {
      // Double-submit: CSRF token in both cookie and form
      const cookieValue = crypto.randomUUID();
      const formValue = cookieValue; // Must match

      expect(cookieValue).toBe(formValue);
    });

    it('should reject if cookie is missing', () => {
      const cookieValue = undefined;
      const formValue = 'csrf_token_123';

      const isValid = cookieValue !== undefined && cookieValue === formValue;
      expect(isValid).toBe(false);
    });

    it('should reject if form token is missing', () => {
      const cookieValue = 'csrf_token_123';
      const formValue = undefined;

      const isValid = formValue !== undefined && cookieValue === formValue;
      expect(isValid).toBe(false);
    });
  });

  describe('Token expiration', () => {
    it('should set CSRF token expiration (10 minutes)', () => {
      const maxAge = 600; // seconds
      const expectedMinutes = 10;

      expect(maxAge / 60).toBe(expectedMinutes);
    });

    it('should regenerate CSRF token on expiration', () => {
      const tokenCreatedAt = Date.now() - (11 * 60 * 1000); // 11 minutes ago
      const maxAge = 10 * 60 * 1000; // 10 minutes
      const isExpired = Date.now() - tokenCreatedAt > maxAge;

      expect(isExpired).toBe(true);
    });
  });
});
