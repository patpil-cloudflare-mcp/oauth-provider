// src/views/templates/auth/authError.ts - Authentication Error Page

import { renderLayout } from '../../components/layout';
import { getCompleteStyles, colors } from '../../components/styles';

export function renderAuthErrorPage(error: string): string {
  // Override h1 color for error state
  const customStyles = `
    ${getCompleteStyles('centered')}
    h1 { color: ${colors.red} !important; }
  `;

  const bodyContent = `
  <div class="container">
    <div class="icon">❌</div>
    <h1>Błąd uwierzytelniania</h1>
    <p>Nie udało się zweryfikować Twojej tożsamości. Spróbuj zalogować się ponownie.</p>

    <div class="error-details">
      <strong>Szczegóły błędu:</strong><br>
      <code>${error}</code>
    </div>

    <a href="/" class="btn">← Powrót na stronę główną</a>
    <a href="/dashboard" class="btn">Spróbuj ponownie</a>
  </div>
  `;

  return renderLayout({
    title: 'Błąd uwierzytelniania | wtyczki.ai',
    description: 'Wystąpił błąd podczas uwierzytelniania. Spróbuj ponownie.',
    noIndex: true,
    includeGoogleFonts: false,
    styles: customStyles,
    bodyContent,
  });
}
