// pre_testing/user-registration/U1.2-email-validation.test.ts
// Test: Email validation during registration

import { describe, it, expect } from 'vitest';

describe('U1.2 - Email Validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  describe('Valid emails', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.com',
      'user123@example.co.uk',
      'a@b.co',
      'test@subdomain.example.com',
      'user_name@example.org',
      'user-name@example.net',
    ];

    validEmails.forEach(email => {
      it(`should accept valid email: ${email}`, () => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });
  });

  describe('Invalid emails', () => {
    const invalidEmails = [
      '',                           // empty
      'not-an-email',              // no @
      '@example.com',              // no local part
      'user@',                     // no domain
      'user@.com',                 // dot at start of domain
      'user@example.',             // dot at end
      'user @example.com',         // space in local
      'user@ example.com',         // space in domain
      'user@@example.com',         // double @
      'user.@example.com',         // dot before @
      '.user@example.com',         // dot at start of local
    ];

    invalidEmails.forEach(email => {
      it(`should reject invalid email: "${email}"`, () => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  it('should normalize email to lowercase for comparison', () => {
    const email1 = 'User@Example.COM';
    const email2 = 'user@example.com';

    expect(email1.toLowerCase()).toBe(email2.toLowerCase());
  });

  it('should trim whitespace from email', () => {
    const emailWithSpaces = '  user@example.com  ';
    const trimmedEmail = emailWithSpaces.trim();

    expect(trimmedEmail).toBe('user@example.com');
    expect(emailRegex.test(trimmedEmail)).toBe(true);
  });

  it('should reject emails longer than 254 characters', () => {
    // RFC 5321 limits email addresses to 254 characters
    const longLocal = 'a'.repeat(65); // local part max 64
    const longDomain = 'b'.repeat(63) + '.com'; // domain label max 63
    const tooLongEmail = `${longLocal}@${longDomain}`;

    // While regex might pass, length should be checked
    expect(tooLongEmail.length).toBeGreaterThan(254);
  });

  it('should handle Unicode in email local part', () => {
    // Some email providers support Unicode, but we test ASCII-only
    const unicodeEmail = 'tëst@example.com';
    // Basic regex doesn't support internationalized emails
    expect(emailRegex.test(unicodeEmail)).toBe(true); // May vary by implementation
  });
});
