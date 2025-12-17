// src/views/templates/auth/authRequired.ts - Authentication Required Page

import { renderLayout } from '../../components/layout';
import { getCompleteStyles } from '../../components/styles';

export function renderAuthRequiredPage(requestedPath: string): string {
  const bodyContent = `
  <div class="container">
    <div class="icon">🔒</div>
    <h1>Wymagane logowanie</h1>
    <p>Ta strona wymaga uwierzytelnienia. Cloudflare Access powinien automatycznie przekierować Cię do strony logowania.</p>

    <div class="info-box">
      <h3>⚠️ Problem z konfiguracją</h3>
      <p>Cloudflare Access nie jest poprawnie skonfigurowany dla tej ścieżki: <code>${requestedPath}</code></p>
      <p style="margin-top: 8px;">Administrator powinien skonfigurować Cloudflare Access w Dashboard → Zero Trust → Access → Applications</p>
    </div>

    <a href="/" class="btn">← Powrót na stronę główną</a>

    <p style="margin-top: 24px; font-size: 13px; color: #999;">
      Próbujesz zalogować się do: ${requestedPath}
    </p>
  </div>
  `;

  return renderLayout({
    title: 'Wymagane logowanie | wtyczki.ai',
    description: 'Strona wymaga uwierzytelnienia. Zaloguj się, aby kontynuować.',
    noIndex: true,
    includeGoogleFonts: false,
    styles: getCompleteStyles('centered'),
    bodyContent,
  });
}
