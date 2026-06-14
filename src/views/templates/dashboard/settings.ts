// src/views/templates/dashboard/settings.ts - Account Settings Page
import type { User } from '../../../types';
import { escapeHtml, escapeJs } from '../../../utils/escapeHtml';
import { renderFooterLinks } from '../../components/links';

export function renderSettingsPage(user: User): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ustawienia konta | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Ustawienia konta - zarządzaj swoim kontem">
  <meta name="robots" content="noindex, nofollow">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>⚙️</text></svg>">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #feffff;
      min-height: 100vh;
      padding: 20px;
      color: #222b4f;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 { color: #222b4f; font-size: 24px; font-weight: 600; }
    .back-link {
      color: #7a0bc0;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .back-link:hover {
      color: #b2478f;
      text-decoration: underline;
    }

    /* Account Information Card */
    .info-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eff4f7;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: rgba(34, 43, 79, 0.65); }
    .info-value { font-weight: 600; color: #222b4f; }

    /* Logout Button */
    .logout-button {
      width: 100%;
      padding: 12px;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 12px;
    }
    .logout-button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(50, 57, 229, 0.4);
    }

    /* Danger Zone */
    .danger-zone {
      background: white;
      border: 2px solid #fee2e2;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .danger-title {
      font-size: 18px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 8px;
    }
    .danger-subtitle {
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .warning-box ul {
      margin-left: 20px;
      margin-top: 8px;
    }
    .warning-box li {
      margin: 4px 0;
      color: #78350f;
    }
    .delete-button {
      width: 100%;
      padding: 12px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .delete-button:hover {
      background: #991b1b;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }

    /* Modal Styles */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .modal-title {
      font-size: 24px;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 16px;
    }
    .modal-content {
      color: #222b4f;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .modal-warning {
      background: #fee2e2;
      border-left: 4px solid #dc2626;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
      color: #991b1b;
    }
    .modal-buttons {
      display: flex;
      gap: 12px;
    }
    .modal-button {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .modal-button-cancel {
      background: #eff4f7;
      color: #222b4f;
    }
    .modal-button-cancel:hover {
      background: #e2e8f0;
    }
    .modal-button-confirm {
      background: #dc2626;
      color: white;
    }
    .modal-button-confirm:hover {
      background: #991b1b;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    }
    .modal-button-proceed {
      background: #f59e0b;
      color: white;
    }
    .modal-button-proceed:hover {
      background: #d97706;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    /* Confirmation Input */
    .confirmation-input {
      width: 100%;
      padding: 12px;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      font-size: 16px;
      font-family: 'DM Sans', sans-serif;
      margin: 16px 0;
      text-align: center;
      font-weight: 600;
      letter-spacing: 2px;
    }
    .confirmation-input:focus {
      outline: none;
      border-color: #dc2626;
    }
    .confirmation-input.valid {
      border-color: #10b981;
      background: #d1fae5;
    }
    .confirmation-input.invalid {
      border-color: #dc2626;
      background: #fee2e2;
    }

    /* API Keys Styles */
    .info-subtitle {
      color: rgba(34, 43, 79, 0.7);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .api-key-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .api-key-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .api-key-name {
      font-weight: 600;
      color: #222b4f;
      font-size: 15px;
    }
    .api-key-prefix {
      font-family: 'Courier New', monospace;
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }
    .api-key-meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #6b7280;
      margin-top: 8px;
    }
    .api-key-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .revoke-button {
      padding: 6px 12px;
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }
    .revoke-button:hover {
      background: #fecaca;
    }
    .copy-button {
      padding: 6px 12px;
      background: #dbeafe;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }
    .copy-button:hover {
      background: #bfdbfe;
    }
    .spinner {
      border: 3px solid #f3f4f6;
      border-top: 3px solid #3239e5;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .buy-button {
      width: 100%;
      padding: 12px;
      background: #3239e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .buy-button:hover {
      background: #140f44;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(50, 57, 229, 0.4);
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 0; }
      .header { padding: 16px; margin-bottom: 12px; }
      h1 { font-size: 20px; }
      .info-card, .danger-zone { padding: 16px; margin-bottom: 12px; }
      .modal { padding: 24px; width: 95%; }
      .modal-buttons { flex-direction: column; }
      .api-key-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    }

    .footer {
      text-align: center;
      padding: 20px;
      color: rgba(34, 43, 79, 0.5);
      font-size: 13px;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .footer-link {
      color: rgba(34, 43, 79, 0.65);
      text-decoration: none;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: #7a0bc0;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Ustawienia konta</h1>
      <a href="/dashboard" class="back-link">← Powrót do panelu</a>
    </div>

    <!-- Account Information -->
    <div class="info-card">
      <h2 class="section-title">Informacje o koncie</h2>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${escapeHtml(user.email)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Konto utworzone</span>
        <span class="info-value">${new Date(user.created_at).toLocaleDateString('pl-PL')}</span>
      </div>

      <!-- Logout Button -->
      <button class="logout-button" onclick="handleLogout()">Wyloguj się</button>
    </div>

    <!-- Danger Zone -->
    <div class="danger-zone">
      <h2 class="danger-title">⚠️ Strefa niebezpieczna</h2>
      <p class="danger-subtitle">Działania w tej sekcji są nieodwracalne</p>

      <div class="warning-box">
        <strong>⚠️ Uwaga! Usunięcie konta jest trwałe i nieodwracalne.</strong>
        <ul>
          <li><strong>Utracisz dostęp</strong> do swojego konta</li>
          <li><strong>Twoje dane osobowe</strong> zostaną zanonimizowane zgodnie z GDPR</li>
        </ul>
      </div>

      <button class="delete-button" onclick="showDeleteWarning()">Usuń moje konto</button>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        ${renderFooterLinks()}
      </div>
      <p>© 2025 Wtyczki DEV Patryk Pilat</p>
    </div>
  </div>

  <!-- Modal: Step 1 - Warning -->
  <div id="modal-warning" class="modal-overlay">
    <div class="modal">
      <h2 class="modal-title">⚠️ Czy na pewno chcesz usunąć konto?</h2>
      <div class="modal-content">
        <p><strong>Ta operacja jest nieodwracalna.</strong></p>
        <div class="modal-warning">
          <p><strong>Utracisz:</strong></p>
          <ul>
            <li>Dostęp do swojego konta</li>
            <li>Wszystkie autoryzowane aplikacje</li>
          </ul>
        </div>
        <p>Jeśli jesteś pewien, kliknij "Kontynuuj", aby przejść do ostatecznego potwierdzenia.</p>
      </div>
      <div class="modal-buttons">
        <button class="modal-button modal-button-cancel" onclick="closeModal('modal-warning')">Anuluj</button>
        <button class="modal-button modal-button-proceed" onclick="showDeleteConfirmation()">Kontynuuj</button>
      </div>
    </div>
  </div>

  <!-- Modal: Step 2 - Final Confirmation with Email Verification -->
  <div id="modal-confirmation" class="modal-overlay">
    <div class="modal" style="max-width: 600px;">
      <h2 class="modal-title">⚠️ Ostateczne potwierdzenie usunięcia konta</h2>

      <!-- Warning -->
      <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #dc2626; font-size: 18px; margin-bottom: 12px;">❌ Ta operacja jest nieodwracalna</h3>
        <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
          Po usunięciu konta wszystkie Twoje dane zostaną zanonimizowane zgodnie z wymogami GDPR.
          Nie będzie możliwości przywrócenia konta.
        </p>
      </div>

      <!-- What Will Be Deleted -->
      <div style="margin: 16px 0;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Co zostanie usunięte:</h3>
        <ul style="margin-left: 20px; line-height: 1.8;">
          <li>❌ Wszystkie autoryzowane aplikacje</li>
          <li>❌ Dane konta</li>
          <li>✅ Email będzie dostępny do ponownej rejestracji</li>
        </ul>
      </div>

      <!-- Email Confirmation -->
      <div style="margin-top: 20px;">
        <p style="font-weight: 600; margin-bottom: 12px;">
          Aby potwierdzić, wpisz swój email: <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${escapeHtml(user.email)}</code>
        </p>
        <input
          type="email"
          id="confirmation-input"
          class="confirmation-input"
          placeholder="Wpisz swój email"
          autocomplete="off"
          style="text-align: left; letter-spacing: normal; font-weight: normal;"
        />
        <p id="email-mismatch" style="color: #dc2626; font-size: 14px; margin-top: 8px; display: none;">
          ❌ Email nie pasuje
        </p>
      </div>

      <div class="modal-buttons" style="margin-top: 24px;">
        <button class="modal-button modal-button-cancel" onclick="closeModal('modal-confirmation')">Anuluj</button>
        <button class="modal-button modal-button-confirm" id="final-delete-button" disabled onclick="confirmAccountDeletion()">Rozumiem i usuwam konto</button>
      </div>
    </div>
  </div>

  <script>
    const userId = '${escapeJs(user.user_id)}';
    const userEmail = '${escapeJs(user.email)}';

    // ============================================================
    // ACCOUNT DELETION
    // ============================================================

    // Show warning modal
    function showDeleteWarning() {
      document.getElementById('modal-warning').classList.add('active');
    }

    // Show confirmation modal
    function showDeleteConfirmation() {
      closeModal('modal-warning');
      document.getElementById('modal-confirmation').classList.add('active');
      document.getElementById('confirmation-input').focus();
    }

    // Close modal
    function closeModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
      if (modalId === 'modal-confirmation') {
        document.getElementById('confirmation-input').value = '';
        document.getElementById('final-delete-button').disabled = true;
        document.getElementById('email-mismatch').style.display = 'none';
        document.getElementById('confirmation-input').classList.remove('valid', 'invalid');
      }
    }

    // Email validation for confirmation input
    const confirmationInput = document.getElementById('confirmation-input');
    const finalDeleteButton = document.getElementById('final-delete-button');
    const emailMismatchError = document.getElementById('email-mismatch');

    confirmationInput.addEventListener('input', () => {
      const enteredEmail = confirmationInput.value.trim().toLowerCase();
      const expectedEmail = userEmail.toLowerCase();

      if (enteredEmail === expectedEmail) {
        confirmationInput.classList.add('valid');
        confirmationInput.classList.remove('invalid');
        finalDeleteButton.disabled = false;
        emailMismatchError.style.display = 'none';
      } else if (enteredEmail.length > 0) {
        confirmationInput.classList.add('invalid');
        confirmationInput.classList.remove('valid');
        finalDeleteButton.disabled = true;
        emailMismatchError.style.display = 'block';
      } else {
        confirmationInput.classList.remove('valid', 'invalid');
        finalDeleteButton.disabled = true;
        emailMismatchError.style.display = 'none';
      }
    });

    // Final account deletion
    async function confirmAccountDeletion() {
      try {
        finalDeleteButton.disabled = true;
        finalDeleteButton.textContent = 'Usuwanie konta...';

        const response = await fetch('/account/delete/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            emailConfirmation: userEmail,
            acknowledgedNoRefund: true
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Nie udało się usunąć konta');
        }

        // Success - redirect to goodbye page
        alert('Twoje konto zostało usunięte. Zostaniesz przekierowany na stronę główną.');
        window.location.href = '/';

      } catch (error) {
        console.error('Deletion error:', error);
        alert('Wystąpił błąd podczas usuwania konta: ' + error.message);
        finalDeleteButton.disabled = false;
        finalDeleteButton.textContent = 'Rozumiem i usuwam konto';
      }
    }

    // Logout handler
    async function handleLogout() {
      try {
        const response = await fetch('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.logoutUrl) {
          // Redirect to WorkOS logout URL
          window.location.href = data.logoutUrl;
        } else {
          // Just redirect to home page
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout error:', error);
        // Fallback: just redirect to home
        window.location.href = '/';
      }
    }

    // Close modal when clicking outside
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });
  </script>
</body>
</html>
  `;
}

