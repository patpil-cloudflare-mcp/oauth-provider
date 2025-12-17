// src/views/templates/dashboard/dashboard.ts - Main Dashboard Page
import type { User } from '../../../types';

export function renderDashboardPage(user: User): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel - System Tokenów MCP | wtyczki.ai</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Panel zarządzania tokenami MCP. Kup tokeny i korzystaj z zaawansowanych serwerów AI opartych na protokole Model Context Protocol.">
  <meta name="keywords" content="MCP, tokeny, AI, Model Context Protocol, wtyczki, API">
  <meta name="author" content="Wtyczki DEV Patryk Pilat">
  <meta name="robots" content="noindex, nofollow">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://panel.wtyczki.ai/">
  <meta property="og:title" content="System Tokenów MCP | wtyczki.ai">
  <meta property="og:description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP">
  <meta property="og:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://panel.wtyczki.ai/">
  <meta property="twitter:title" content="System Tokenów MCP | wtyczki.ai">
  <meta property="twitter:description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP">
  <meta property="twitter:image" content="https://panel.wtyczki.ai/og-image.png">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔌</text></svg>">
  <link rel="alternate icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAITSURBVFiF7ZbPaxNBFMe/b7KbTZs0aY0/qBWxRfHgQTx48OBN8OTRf8KbePTkH+HRk+DBg6AHQfCgCCKCWrFYLNJiG5ukSdpkd2Z2PN0km92ZTZqeBPvhwczOm/d9b96b92aB/3qsqgC6urr6AXwEcBpAE8ALAM+llLdXUdvmCO4B+CilzCilegD0A3gE4LmUcmndBBzHuQbguZTys2EY9wAcBXBQStkDoB/AcwAnAFw1DOPuOgl0dXVdBvAEwF0pZRaABqAJoAHgAIBuADcBvJJSPl4XgZ6enhsA3gC4KaWcBqADaAHwAVQB1AB8BfAOwIiU8s5aCFiW1QfgLYBbUsoJABqAEkAZQBXAbwBlABMA3gO4LqUcWjkBwzD6ALwH8EBKOQ5AA1AEUALwC8AXAF8AvARwRUp5e+UELMvqBzAG4J6UcgxAHcAvAN8BfALwGsBVKeWdtRCwbXsQwBsA94eiCSEAAA0ASURBVKWUY7ZtvwdwAMAvAJ8BfADwVkr5cC0EhoeHDwF4DeC6lDIzPj7u2PYo/JlfAPgAYATAIynl01UQOAygH8BDKWUW/sRnAYwC+AIgB38i7kkpn62SwEkAXQCuSymnAIzBX3l/4Lfg7oYEHA3A5wD8AlACMAPfgFEAI1LKp+sm0NnZeQrATQDnADQAvAPwSEr5Yl0EHA3AWQAXAJwF0ADwFsBDKeWL/1XgX/0Bl8LKBwDOaygAAAAASUVORK5CYII=">

  <!-- Google Fonts: DM Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wgt@400;500;600;700&display=swap" rel="stylesheet">

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
      max-width: 1200px;
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
    .user-email { color: rgba(34, 43, 79, 0.65); font-size: 14px; margin-top: 4px; }
    .settings-link {
      color: #7a0bc0;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .settings-link:hover {
      background: #f3e8ff;
      color: #b2478f;
      transform: translateY(-2px);
    }
    .balance-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    .balance-label { color: rgba(34, 43, 79, 0.65); font-size: 18px; margin-bottom: 8px; font-weight: 500; }
    .balance-value {
      font-size: 48px;
      font-weight: 700;
      background: linear-gradient(135deg, #3239e5 0%, #140f44 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .balance-unit { font-size: 24px; color: rgba(34, 43, 79, 0.5); margin-left: 8px; }
    .packages {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 1400px) {
      .packages {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 768px) {
      .packages {
        grid-template-columns: 1fr;
      }
    }
    .package-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
      border: 2px solid transparent;
    }
    .package-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(50, 57, 229, 0.15);
      border-color: #3239e5;
    }
    .package-name {
      font-size: 20px;
      font-weight: 600;
      color: #222b4f;
      margin-bottom: 8px;
      background: #e6174b;
      color: white;
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      border: 2px solid #b71338;
      margin-bottom: 12px;
    }
    .package-price { font-size: 32px; font-weight: 700; color: #3239e5; margin-bottom: 4px; }
    .package-tokens { color: rgba(34, 43, 79, 0.7); font-size: 14px; margin-bottom: 16px; }
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

    /* Promotional Badge */
    .promo-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      border: 3px solid white;
      transform: rotate(5deg);
      animation: pulse 2s infinite;
      z-index: 10;
      white-space: nowrap;
    }
    @keyframes pulse {
      0%, 100% { transform: rotate(5deg) scale(1); }
      50% { transform: rotate(5deg) scale(1.05); }
    }
    .promo-badge-gold {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    /* Best Value Badge (Pro Package) */
    .best-value-badge {
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.4);
      border: 3px solid white;
      transform: rotate(5deg);
      animation: pulse 2s infinite;
      z-index: 10;
      white-space: nowrap;
    }

    /* Package Value (Cost per Token) */
    .package-value {
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      margin-bottom: 8px;
      font-weight: 500;
    }

    /* Package Savings */
    .package-savings {
      background: #d1fae5;
      color: #065f46;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 12px;
    }

    /* Featured Package Card (Pro) */
    .package-card-featured {
      transform: scale(1.05);
      border: 3px solid #7a0bc0;
      box-shadow: 0 8px 24px rgba(122, 11, 192, 0.25);
      background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
    }
    .package-card-featured:hover {
      transform: scale(1.05) translateY(-4px);
      box-shadow: 0 12px 32px rgba(122, 11, 192, 0.35);
      border-color: #b2478f;
    }

    .stats {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eff4f7;
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: rgba(34, 43, 79, 0.65); }
    .stat-value { font-weight: 600; color: #222b4f; }

    /* Transaction History Styles */
    .transactions-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #222b4f;
    }
    .filter-buttons {
      display: flex;
      gap: 8px;
    }
    .filter-btn {
      padding: 6px 16px;
      border: 1px solid #eff4f7;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      color: #222b4f;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      border-color: #7a0bc0;
      color: #7a0bc0;
    }
    .filter-btn.active {
      background: #3239e5;
      color: white;
      border-color: #3239e5;
    }
    .transactions-table {
      width: 100%;
      border-collapse: collapse;
    }
    .transactions-table th {
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #eff4f7;
      color: rgba(34, 43, 79, 0.65);
      font-size: 14px;
      font-weight: 600;
    }
    .transactions-table td {
      padding: 12px;
      border-bottom: 1px solid #eff4f7;
      font-size: 14px;
      color: #222b4f;
    }
    .transactions-table tr:hover {
      background: #eff4f7;
    }
    .type-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .type-purchase {
      background: #d1fae5;
      color: #065f46;
    }
    .type-usage {
      background: #fee2e2;
      color: #991b1b;
    }
    .amount-positive {
      color: #059669;
      font-weight: 600;
    }
    .amount-negative {
      color: #dc2626;
      font-weight: 600;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: rgba(34, 43, 79, 0.65);
    }
    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 12px;
      border-radius: 8px;
      margin: 12px 0;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: rgba(34, 43, 79, 0.65);
    }

    /* Footer Styles */
    .footer {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-top: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .footer-link {
      color: #222b4f;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .footer-link:hover {
      color: #7a0bc0;
      text-decoration: underline;
    }
    .footer-link:visited {
      color: #b2478f;
    }
    .footer-text {
      color: rgba(34, 43, 79, 0.65);
      font-size: 13px;
      margin-top: 8px;
    }

    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }

      .container {
        padding: 0;
      }

      .header {
        padding: 16px;
        margin-bottom: 12px;
      }

      h1 {
        font-size: 20px;
      }

      .user-email {
        font-size: 12px;
      }

      .balance-card {
        padding: 24px 16px;
        margin-bottom: 12px;
      }

      .balance-value {
        font-size: 36px;
      }

      .balance-unit {
        font-size: 18px;
      }

      .packages {
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 12px;
      }

      .package-card {
        padding: 20px;
      }

      /* Featured package - reduce scale on mobile */
      .package-card-featured {
        transform: scale(1);
        border: 2px solid #7a0bc0;
      }
      .package-card-featured:hover {
        transform: translateY(-4px);
      }

      .stats {
        padding: 16px;
        margin-bottom: 12px;
      }

      .transactions-section {
        padding: 16px;
      }

      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .section-title {
        font-size: 18px;
      }

      .filter-buttons {
        width: 100%;
        justify-content: space-between;
      }

      .filter-btn {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
      }

      .transactions-table {
        font-size: 12px;
      }

      .transactions-table th,
      .transactions-table td {
        padding: 8px 4px;
      }

      .transactions-table th:nth-child(3),
      .transactions-table td:nth-child(3) {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .footer {
        padding: 16px;
        margin-top: 12px;
      }

      .footer-links {
        flex-direction: column;
        gap: 12px;
      }

      .footer-text {
        font-size: 12px;
      }
    }

    @media (max-width: 480px) {
      .balance-value {
        font-size: 32px;
      }

      .package-name {
        font-size: 18px;
      }

      .package-price {
        font-size: 28px;
      }

      /* Make table scrollable on very small screens */
      .transactions-table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
      }

      .transactions-table thead,
      .transactions-table tbody,
      .transactions-table tr {
        display: table;
        width: 100%;
        table-layout: fixed;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>System tokenów wtyczki.ai</h1>
        <div class="user-email">${user.email}</div>
      </div>
      <a href="/dashboard/settings" class="settings-link">⚙️ Ustawienia</a>
    </div>

    <div class="balance-card">
      <div class="balance-label">Aktualny stan tokenów</div>
      <div>
        <span class="balance-value">${user.current_token_balance}</span>
        <span class="balance-unit">tokenów</span>
      </div>
    </div>

    <div class="packages">
      <div class="package-card">
        <div class="package-name">Starter</div>
        <div class="package-price">10 zł</div>
        <div class="package-tokens">500 tokenów</div>
        <div class="package-value">2 grosze za token</div>
        <button class="buy-button" onclick="buyPackage('starter')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="package-name">Plus</div>
        <div class="package-price">25 zł</div>
        <div class="package-tokens">2 000 tokenów</div>
        <div class="package-value">1,25 grosza za token</div>
        <button class="buy-button" onclick="buyPackage('plus')">Kup teraz</button>
      </div>

      <div class="package-card package-card-featured">
        <div class="best-value-badge">⭐ Najpopularniejszy</div>
        <div class="package-name">Pro</div>
        <div class="package-price">59 zł</div>
        <div class="package-tokens">5 500 tokenów</div>
        <div class="package-value">1,07 grosza za token</div>
        <div class="package-savings">500 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackage('pro')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="promo-badge promo-badge-gold">💎 Superpakiet</div>
        <div class="package-name">Gold</div>
        <div class="package-price">119 zł</div>
        <div class="package-tokens">12 000 tokenów</div>
        <div class="package-value">0,99 grosza za token</div>
        <div class="package-savings">2 000 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackage('gold')">Kup teraz</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">Zakupione tokeny (łącznie)</span>
        <span class="stat-value">${user.total_tokens_purchased} tokenów</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Wykorzystane tokeny (łącznie)</span>
        <span class="stat-value">${user.total_tokens_used} tokenów</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Konto utworzone</span>
        <span class="stat-value">${new Date(user.created_at).toLocaleDateString('pl-PL')}</span>
      </div>
    </div>

    <!-- Transaction History Section -->
    <div class="transactions-section">
      <div class="section-header">
        <h2 class="section-title">Historia transakcji</h2>
        <div class="filter-buttons">
          <button class="filter-btn active" data-filter="all">Wszystkie</button>
          <button class="filter-btn" data-filter="purchase">Zakupy</button>
          <button class="filter-btn" data-filter="usage">Użycie</button>
        </div>
      </div>

      <div id="transactions-content">
        <div class="loading">Ładowanie historii transakcji...</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="/privacy" class="footer-link">Polityka Prywatności</a>
        <a href="/terms" class="footer-link">Regulamin</a>
        <a href="mailto:support@wtyczki.pl" class="footer-link">Kontakt</a>
      </div>
      <div class="footer-text">
        © 2025 Wtyczki DEV Patryk Pilat<br>
        NIP: [DO_UZUPEŁNIENIA] | Adres: [DO_UZUPEŁNIENIA]<br>
        System Tokenów MCP - Płatności obsługiwane przez Stripe
      </div>
    </div>
  </div>

  <script>
    // State management
    let currentFilter = 'all';
    const userId = '${user.user_id}';

    // Fetch and display transactions
    async function loadTransactions(type = 'all') {
      const content = document.getElementById('transactions-content');
      content.innerHTML = '<div class="loading">Ładowanie...</div>';

      try {
        const response = await fetch(\`/user/transactions?type=\${type}&limit=20&offset=0\`);

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();

        if (data.transactions.length === 0) {
          content.innerHTML = '<div class="empty-state">Brak transakcji</div>';
          return;
        }

        // Render transactions table
        let html = \`
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Typ</th>
                <th>Opis</th>
                <th>Kwota</th>
                <th>Saldo po</th>
              </tr>
            </thead>
            <tbody>
        \`;

        data.transactions.forEach(tx => {
          const date = new Date(tx.created_at);
          const dateStr = date.toLocaleString('pl-PL', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const typeBadge = tx.type === 'purchase'
            ? '<span class="type-badge type-purchase">Zakup</span>'
            : '<span class="type-badge type-usage">Użycie</span>';

          const amountClass = tx.token_amount > 0 ? 'amount-positive' : 'amount-negative';
          const amountStr = tx.token_amount > 0 ? \`+\${tx.token_amount}\` : tx.token_amount;

          html += \`
            <tr>
              <td>\${dateStr}</td>
              <td>\${typeBadge}</td>
              <td>\${tx.description || 'Brak opisu'}</td>
              <td class="\${amountClass}">\${amountStr} tokenów</td>
              <td>\${tx.balance_after} tokenów</td>
            </tr>
          \`;
        });

        html += \`
            </tbody>
          </table>
        \`;

        content.innerHTML = html;

      } catch (error) {
        console.error('Error loading transactions:', error);
        content.innerHTML = '<div class="error-message">Nie udało się załadować historii transakcji. Spróbuj ponownie.</div>';
      }
    }

    // Filter button handlers
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Load filtered transactions
        const filter = btn.dataset.filter;
        currentFilter = filter;
        loadTransactions(filter);
      });
    });

    // Purchase flow - Create Stripe checkout session
    async function buyPackage(tier) {
      try {
        // Map tier to price ID (from Stripe Dashboard)
        const priceIds = {
          starter: 'price_1SJdj8CxCMDDEXzpiZ9SYQ7x',  // 10 PLN - 500 tokens
          plus: 'price_1SIlbLCxCMDDEXzpnDMP47aj',     // 25 PLN - 2000 tokens
          pro: 'price_1SIlbLCxCMDDEXzpBbdn6o22',      // 59 PLN - 5500 tokens
          gold: 'price_1SIlbLCxCMDDEXzpf7YBJcBY'     // 119 PLN - 12000 tokens (Gold)
        };

        const priceId = priceIds[tier];
        if (!priceId) {
          alert('Nieprawidłowy pakiet');
          return;
        }

        // Disable button during checkout creation
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Tworzenie płatności...';

        // Create Stripe checkout session
        const response = await fetch('/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            priceId: priceId
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create checkout session');
        }

        const data = await response.json();

        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }

      } catch (error) {
        console.error('Checkout error:', error);
        alert('Nie udało się rozpocząć płatności: ' + error.message);
        // Re-enable button
        if (event && event.target) {
          event.target.disabled = false;
          event.target.textContent = 'Kup teraz';
        }
      }
    }

    // Load transactions on page load
    loadTransactions('all');
  </script>
</body>
</html>
  `;
}

// Public home page (no authentication required)
