// src/views/templates/public/pricing.ts - Token Pricing Page

export function renderPricingPage(): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kup tokeny MCP | wtyczki.ai</title>
  <meta name="description" content="System prepaid tokenów dla dostępu do serwerów AI opartych na protokole MCP. Kup tokeny i zacznij korzystać z zaawansowanych narzędzi AI.">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔌</text></svg>">
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
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-logo img { height: 40px; width: auto; }
    h1 { font-size: 24px; font-weight: 700; }
    .header-link {
      color: #7a0bc0;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .header-link:hover { background: #f3e8ff; }

    .email-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
      text-align: center;
    }
    .email-label {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .email-input {
      width: 100%;
      max-width: 400px;
      padding: 14px 20px;
      border: 2px solid #eff4f7;
      border-radius: 8px;
      font-size: 16px;
      font-family: 'DM Sans', sans-serif;
      transition: all 0.3s;
    }
    .email-input:focus {
      outline: none;
      border-color: #7a0bc0;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.25);
    }
    .email-hint {
      color: rgba(34, 43, 79, 0.5);
      font-size: 13px;
      margin-top: 8px;
    }

    .packages {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    .package-card {
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      border: 2px solid transparent;
      text-align: center;
    }
    .package-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(122, 11, 192, 0.2);
      border-color: #7a0bc0;
    }
    .package-card-featured {
      border: 3px solid #7a0bc0;
      position: relative;
      box-shadow: 0 8px 24px rgba(122, 11, 192, 0.25);
    }
    .featured-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
      padding: 4px 16px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .package-name {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(34, 43, 79, 0.5);
      margin-bottom: 8px;
    }
    .package-price {
      font-size: 40px;
      font-weight: 700;
      color: #222b4f;
      margin-bottom: 4px;
    }
    .package-price span { font-size: 18px; font-weight: 500; }
    .package-tokens {
      font-size: 18px;
      font-weight: 600;
      color: #7a0bc0;
      margin-bottom: 4px;
    }
    .package-value {
      color: rgba(34, 43, 79, 0.5);
      font-size: 13px;
      margin-bottom: 16px;
    }
    .package-savings {
      background: #d1fae5;
      color: #065f46;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 16px;
    }
    .buy-button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #7a0bc0 0%, #b2478f 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
    }
    .buy-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.4);
    }
    .buy-button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .trust-section {
      background: white;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
    }
    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .trust-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(34, 43, 79, 0.7);
      font-size: 14px;
    }
    .trust-icon { font-size: 18px; }

    .login-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(122, 11, 192, 0.1);
    }
    .login-link {
      color: #7a0bc0;
      text-decoration: none;
      font-weight: 600;
    }
    .login-link:hover { text-decoration: underline; }

    .footer {
      text-align: center;
      padding: 20px;
      color: rgba(34, 43, 79, 0.5);
      font-size: 13px;
    }

    @media (max-width: 768px) {
      .packages { grid-template-columns: 1fr; }
      .header { flex-direction: column; gap: 12px; }
      .package-card-featured { border-width: 2px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="header-logo">
          <img src="/wtyczkiai_logo_panel.png" alt="wtyczki.ai" />
        </div>
        <h1>Kup tokeny</h1>
      </div>
      <a href="/dashboard" class="header-link">Panel klienta</a>
    </div>

    <div class="email-card">
      <div class="email-label">Podaj email, aby kupić tokeny</div>
      <input type="email" id="guestEmail" class="email-input" placeholder="twoj@email.com" required />
      <p class="email-hint">Ten email posłuży do zalogowania się do Panelu Klienta</p>
    </div>

    <div class="login-card">
      Masz już konto? <a href="/?tab=login" class="login-link">Zaloguj się</a>
    </div>

    <div class="packages">
      <div class="package-card">
        <div class="package-name">Starter</div>
        <div class="package-price">20 <span>PLN</span></div>
        <div class="package-tokens">2 000 tokenów</div>
        <div class="package-value">1 grosz za token</div>
        <button class="buy-button" onclick="buyPackage('starter')">Kup teraz</button>
      </div>

      <div class="package-card package-card-featured">
        <div class="featured-badge">Najpopularniejszy</div>
        <div class="package-name">Pro</div>
        <div class="package-price">50 <span>PLN</span></div>
        <div class="package-tokens">5 500 tokenów</div>
        <div class="package-value">0,91 gr za token</div>
        <div class="package-savings">500 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackage('pro')">Kup teraz</button>
      </div>

      <div class="package-card">
        <div class="package-name">Gold</div>
        <div class="package-price">100 <span>PLN</span></div>
        <div class="package-tokens">12 000 tokenów</div>
        <div class="package-value">0,83 gr za token</div>
        <div class="package-savings">2 000 tokenów gratis!</div>
        <button class="buy-button" onclick="buyPackage('gold')">Kup teraz</button>
      </div>
    </div>

    <div class="trust-section">
      <div class="trust-badges">
        <div class="trust-badge"><span class="trust-icon">🔒</span> Bezpieczne płatności Stripe</div>
        <div class="trust-badge"><span class="trust-icon">♾️</span> Tokeny bez daty ważności</div>
        <div class="trust-badge"><span class="trust-icon">⚡</span> Natychmiastowy dostęp</div>
      </div>
    </div>

    <div class="footer">
      <a href="/privacy" class="login-link" style="font-weight: 400;">Polityka Prywatności</a> ·
      <a href="/terms" class="login-link" style="font-weight: 400;">Regulamin</a>
      <p style="margin-top: 8px;">© 2025 Wtyczki DEV Patryk Pilat</p>
    </div>
  </div>

  <script>
    const PRICE_IDS = {
      starter: 'price_1TEctDCyk6tKob8SClH88Dzf',
      pro: 'price_1TEctECyk6tKob8SzsWEmQqi',
      gold: 'price_1TEctECyk6tKob8SGtBmYS4w'
    };

    async function buyPackage(tier) {
      const emailInput = document.getElementById('guestEmail');
      const email = emailInput.value.trim();

      if (!email) {
        alert('Proszę podać adres email');
        emailInput.focus();
        return;
      }

      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        alert('Proszę podać poprawny adres email');
        emailInput.focus();
        return;
      }

      const priceId = PRICE_IDS[tier];
      if (!priceId) { alert('Nieprawidłowy pakiet'); return; }

      const buttons = document.querySelectorAll('.buy-button');
      const clicked = event.target;
      buttons.forEach(b => { b.disabled = true; });
      clicked.textContent = 'Tworzenie płatności...';

      try {
        const res = await fetch('https://api.wtyczki.ai/checkout/create-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, priceId })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Nie udało się utworzyć sesji płatności');
        }

        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('Brak URL płatności');
        }
      } catch (error) {
        alert('Błąd: ' + error.message);
        buttons.forEach(b => { b.disabled = false; b.textContent = 'Kup teraz'; });
      }
    }

    window.addEventListener('pageshow', function(e) {
      if (e.persisted) {
        document.querySelectorAll('.buy-button').forEach(b => {
          b.disabled = false;
          b.textContent = 'Kup teraz';
        });
      }
    });
  </script>
</body>
</html>
  `;
}
