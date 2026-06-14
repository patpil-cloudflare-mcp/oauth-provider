// src/views/components/links.ts - Single source of truth for legal/contact links

export const LEGAL_PRIVACY_URL = 'https://wtyczki.ai/polityka-prywatnosci/';
export const LEGAL_TERMS_URL = 'https://wtyczki.ai/regulamin-serwisu/';
export const CONTACT_EMAIL = 'hello@patrykpilat.pl';

/**
 * Three class-styled footer links (Polityka Prywatności · Regulamin · Kontakt).
 * Shared by the dashboard, settings, and unified auth footers.
 */
export function renderFooterLinks(): string {
  return `<a href="${LEGAL_PRIVACY_URL}" target="_blank" rel="noopener noreferrer" class="footer-link">Polityka Prywatności</a>
        <a href="${LEGAL_TERMS_URL}" target="_blank" rel="noopener noreferrer" class="footer-link">Regulamin</a>
        <a href="mailto:${CONTACT_EMAIL}" class="footer-link">Kontakt</a>`;
}
