// src/views/templates/dashboard/dashboard.ts - Main Dashboard Page
import type { User } from '../../../types';

interface ApiKey {
  api_key_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: number;
}

export function renderDashboardPage(user: User, apiKeys: ApiKey[] = []): string {
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Nigdy';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const apiKeysHtml = apiKeys.length > 0
    ? apiKeys.map(key => `
        <tr>
          <td class="key-name">${key.name || 'Bez nazwy'}</td>
          <td class="key-prefix"><code>${key.key_prefix}...</code></td>
          <td>${formatDate(key.created_at)}</td>
          <td>${formatDate(key.last_used_at)}</td>
          <td>
            <span class="status-badge ${key.is_active ? 'status-active' : 'status-inactive'}">
              ${key.is_active ? 'Aktywny' : 'Nieaktywny'}
            </span>
          </td>
          <td>
            <button class="action-btn action-btn-danger" onclick="revokeApiKey('${key.api_key_id}')">
              Usuń
            </button>
          </td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="6" class="empty-state">
            <div class="empty-icon">🔑</div>
            <p>Nie masz jeszcze żadnych kluczy API</p>
            <p class="empty-hint">Utwórz klucz, aby połączyć aplikacje MCP</p>
          </td>
        </tr>
      `;

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel MCP | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Panel zarządzania aplikacjami MCP i kluczami API. Bezpieczne uwierzytelnianie OAuth 2.1.">
  <meta name="keywords" content="MCP, OAuth, API, Model Context Protocol, wtyczki">
  <meta name="author" content="Wtyczki DEV Patryk Pilat">
  <meta name="robots" content="noindex, nofollow">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔌</text></svg>">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #f5f3ff;
      min-height: 100vh;
      padding: 20px;
      color: #222b4f;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-logo img {
      height: 40px;
      width: auto;
    }
    h1 {
      color: #222b4f;
      font-size: 24px;
      font-weight: 700;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .user-email {
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
    }
    .header-link {
      color: #7a0bc0;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .header-link:hover {
      background: #f3e8ff;
      color: #b2478f;
    }
    .logout-btn {
      background: #fee2e2;
      color: #dc2626;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .logout-btn:hover {
      background: #fecaca;
    }

    /* Cards */
    .card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 20px;
      font-weight: 600;
      color: #222b4f;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-title-icon {
      font-size: 24px;
    }

    /* Account Info */
    .account-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .account-item {
      padding: 16px;
      background: #f5f3ff;
      border-radius: 12px;
    }
    .account-label {
      font-size: 13px;
      color: rgba(34, 43, 79, 0.65);
      margin-bottom: 4px;
    }
    .account-value {
      font-size: 16px;
      font-weight: 600;
      color: #222b4f;
    }

    /* API Keys Table */
    .api-keys-table {
      width: 100%;
      border-collapse: collapse;
    }
    .api-keys-table th {
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #eff4f7;
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .api-keys-table td {
      padding: 12px;
      border-bottom: 1px solid #eff4f7;
      font-size: 14px;
      color: #222b4f;
    }
    .api-keys-table tr:hover {
      background: #faf5ff;
    }
    .key-name {
      font-weight: 600;
    }
    .key-prefix code {
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 13px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-active {
      background: #d1fae5;
      color: #065f46;
    }
    .status-inactive {
      background: #fee2e2;
      color: #991b1b;
    }

    /* Action Buttons */
    .action-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .action-btn-primary {
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
    }
    .action-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.35);
    }
    .action-btn-danger {
      background: #fee2e2;
      color: #dc2626;
    }
    .action-btn-danger:hover {
      background: #fecaca;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: rgba(34, 43, 79, 0.65);
    }
    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .empty-state p {
      margin-bottom: 8px;
    }
    .empty-hint {
      font-size: 13px;
      color: rgba(34, 43, 79, 0.5);
    }

    /* Authorized Apps Section */
    .apps-list {
      display: grid;
      gap: 12px;
    }
    .app-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f5f3ff;
      border-radius: 12px;
    }
    .app-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .app-icon {
      width: 40px;
      height: 40px;
      background: white;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .app-name {
      font-weight: 600;
      color: #222b4f;
    }
    .app-meta {
      font-size: 13px;
      color: rgba(34, 43, 79, 0.65);
    }

    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.visible {
      display: flex;
    }
    .modal {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-title {
      font-size: 20px;
      font-weight: 700;
      color: #222b4f;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 8px;
    }
    .form-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      font-size: 16px;
      font-family: 'DM Sans', sans-serif;
      transition: all 0.2s;
    }
    .form-input:focus {
      outline: none;
      border-color: #7a0bc0;
      box-shadow: 0 0 0 3px rgba(122, 11, 192, 0.15);
    }
    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .new-key-display {
      background: #f5f3ff;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .new-key-label {
      font-size: 13px;
      color: rgba(34, 43, 79, 0.65);
      margin-bottom: 8px;
    }
    .new-key-value {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 14px;
      word-break: break-all;
      background: white;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #eff4f7;
    }
    .warning-box {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 20px;
    }

    /* Footer */
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

    /* Responsive */
    @media (max-width: 768px) {
      body { padding: 12px; }
      .header {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }
      .header-left {
        flex-direction: column;
      }
      .header-right {
        flex-wrap: wrap;
        justify-content: center;
      }
      .card { padding: 20px; }
      .card-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }
      .api-keys-table {
        display: block;
        overflow-x: auto;
      }
      .modal { padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="header-logo">
          <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
        </div>
        <h1>Panel MCP</h1>
      </div>
      <div class="header-right">
        <span class="user-email">${user.email}</span>
        <a href="/dashboard/settings" class="header-link">⚙️ Ustawienia</a>
        <form action="/auth/logout" method="POST" style="display: inline;">
          <button type="submit" class="logout-btn">Wyloguj</button>
        </form>
      </div>
    </div>

    <!-- Account Info Card -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <span class="card-title-icon">👤</span>
          Informacje o koncie
        </h2>
      </div>
      <div class="account-grid">
        <div class="account-item">
          <div class="account-label">Adres e-mail</div>
          <div class="account-value">${user.email}</div>
        </div>
        <div class="account-item">
          <div class="account-label">Konto utworzone</div>
          <div class="account-value">${formatDate(user.created_at)}</div>
        </div>
        <div class="account-item">
          <div class="account-label">Ostatnie logowanie</div>
          <div class="account-value">${formatDate(user.last_login_at)}</div>
        </div>
      </div>
    </div>

    <!-- API Keys Card -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <span class="card-title-icon">🔑</span>
          Klucze API
        </h2>
        <button class="action-btn action-btn-primary" onclick="showCreateKeyModal()">
          + Utwórz klucz
        </button>
      </div>
      <table class="api-keys-table">
        <thead>
          <tr>
            <th>Nazwa</th>
            <th>Klucz</th>
            <th>Utworzony</th>
            <th>Ostatnio użyty</th>
            <th>Status</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          ${apiKeysHtml}
        </tbody>
      </table>
    </div>

    <!-- Authorized Apps Card -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          <span class="card-title-icon">🔌</span>
          Autoryzowane aplikacje MCP
        </h2>
      </div>
      <div class="apps-list">
        <div class="empty-state">
          <div class="empty-icon">📱</div>
          <p>Nie autoryzowałeś jeszcze żadnych aplikacji MCP</p>
          <p class="empty-hint">Aplikacje pojawią się tutaj po autoryzacji przez OAuth 2.1</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="/privacy" class="footer-link">Polityka Prywatności</a>
        <a href="/terms" class="footer-link">Regulamin</a>
        <a href="mailto:support@wtyczki.pl" class="footer-link">Kontakt</a>
      </div>
      <p>© 2025 Wtyczki DEV Patryk Pilat</p>
    </div>
  </div>

  <!-- Create API Key Modal -->
  <div id="createKeyModal" class="modal-overlay">
    <div class="modal">
      <h3 class="modal-title">Utwórz nowy klucz API</h3>
      <form id="createKeyForm" onsubmit="createApiKey(event)">
        <div class="form-group">
          <label class="form-label" for="keyName">Nazwa klucza</label>
          <input
            type="text"
            id="keyName"
            class="form-input"
            placeholder="np. Produkcja, Testowy"
            required
          />
        </div>
        <div class="modal-actions">
          <button type="button" class="action-btn" onclick="hideCreateKeyModal()" style="background: #f3f4f6; color: #374151;">
            Anuluj
          </button>
          <button type="submit" class="action-btn action-btn-primary">
            Utwórz klucz
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- New Key Display Modal -->
  <div id="newKeyModal" class="modal-overlay">
    <div class="modal">
      <h3 class="modal-title">Klucz API utworzony</h3>
      <div class="warning-box">
        ⚠️ Zapisz ten klucz teraz! Nie będziesz mógł go zobaczyć ponownie.
      </div>
      <div class="new-key-display">
        <div class="new-key-label">Twój nowy klucz API:</div>
        <div id="newKeyValue" class="new-key-value"></div>
      </div>
      <div class="modal-actions">
        <button class="action-btn action-btn-primary" onclick="copyAndClose()">
          Skopiuj i zamknij
        </button>
      </div>
    </div>
  </div>

  <script>
    const userId = '${user.user_id}';

    function showCreateKeyModal() {
      document.getElementById('createKeyModal').classList.add('visible');
      document.getElementById('keyName').focus();
    }

    function hideCreateKeyModal() {
      document.getElementById('createKeyModal').classList.remove('visible');
      document.getElementById('createKeyForm').reset();
    }

    async function createApiKey(event) {
      event.preventDefault();

      const name = document.getElementById('keyName').value.trim();
      if (!name) {
        alert('Proszę podać nazwę klucza');
        return;
      }

      try {
        const response = await fetch('/api/keys/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nie udało się utworzyć klucza');
        }

        const data = await response.json();

        // Hide create modal
        hideCreateKeyModal();

        // Show new key modal
        document.getElementById('newKeyValue').textContent = data.apiKey;
        document.getElementById('newKeyModal').classList.add('visible');

      } catch (error) {
        alert('Błąd: ' + error.message);
      }
    }

    function copyAndClose() {
      const keyValue = document.getElementById('newKeyValue').textContent;
      navigator.clipboard.writeText(keyValue).then(() => {
        document.getElementById('newKeyModal').classList.remove('visible');
        window.location.reload();
      }).catch(() => {
        alert('Nie udało się skopiować. Skopiuj klucz ręcznie.');
      });
    }

    async function revokeApiKey(apiKeyId) {
      if (!confirm('Czy na pewno chcesz usunąć ten klucz API? Tej operacji nie można cofnąć.')) {
        return;
      }

      try {
        const response = await fetch('/api/keys/' + apiKeyId, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nie udało się usunąć klucza');
        }

        window.location.reload();

      } catch (error) {
        alert('Błąd: ' + error.message);
      }
    }

    // Close modals on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        hideCreateKeyModal();
        document.getElementById('newKeyModal').classList.remove('visible');
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) {
          this.classList.remove('visible');
        }
      });
    });
  </script>
</body>
</html>
  `;
}
