# CLAUDE.md — mcp-oauth (panel.wtyczki.ai)

> Worker odpowiedzialny za tozsamosc uzytkownikow platformy wtyczki.ai.
> Przeczytaj tez `/mcp-monorepo/CLAUDE.md` (root) dla kontekstu calej platformy.

## 1. ROLA

Jedyne zrodlo tozsamosci. Zarzadza:
- Sesjami (WorkOS AuthKit + Magic Auth)
- Kluczami API (`wtyk_*`)
- Endpointem `/oauth/userinfo` (serce auth calej platformy)
- MCP discovery (`.well-known`)
- Dashboardem uzytkownika (HTML)
- Billing proxy do mcp-token-system (Service Binding)

## 2. STACK

| Element | Wartosc |
|---------|---------|
| Platform | Cloudflare Workers |
| Language | TypeScript 6.x |
| Database | D1 (`TOKEN_DB` binding) |
| KV | `USER_SESSIONS` (sesje) |
| Service Binding | `BILLING_API` → mcp-token-system |
| Auth provider | WorkOS AuthKit |
| Email | Resend (kody Magic Auth) |
| JWT | `jose` (weryfikacja AuthKit JWKS) |
| Worker name | `oauth-provider` |
| Domena | `panel.wtyczki.ai` |
| Compatibility | `2024-11-20`, `nodejs_compat` |

## 3. ENDPOINTY

### Publiczne (bez auth)

| Sciezka | Metoda | Opis |
|---------|--------|------|
| `/` | GET | Unified auth page (login/rejestracja) lub API status |
| `/oauth/userinfo` | GET | Zwraca `{ sub, email }` — API key lub AuthKit JWT |
| `/.well-known/oauth-protected-resource` | GET | MCP discovery |
| `/.well-known/oauth-authorization-server` | GET | Proxy do AuthKit metadata |
| `/auth/login` | GET | Redirect do unified auth |
| `/auth/callback` | GET | WorkOS callback → tworzy sesje |
| `/auth/login-custom/send-code` | POST | Magic Auth — wyslij kod (rate limit: 5/60s) |
| `/auth/login-custom/verify-code` | POST | Magic Auth — weryfikuj kod (rate limit: 10/60s) |
| `/auth/connect-login` | GET | AuthKit Standalone Connect |
| `/auth/logout-success` | GET | Strona po wylogowaniu |
| `/pricing` | GET | Pakiety tokenow |
| `/privacy` | GET | Polityka prywatnosci |
| `/terms` | GET | Regulamin |
| `/public/*` | GET | Statyczne assety (logo) |

### Chronione (wymagaja sesji cookie)

| Sciezka | Metoda | Opis |
|---------|--------|------|
| `/auth/user` | GET | Info o uzytkowniku (JSON) |
| `/dashboard` | GET | Panel uzytkownika (HTML) |
| `/dashboard/settings` | GET | Ustawienia konta |
| `/api/keys/create` | POST | Nowy klucz API (rate limit: 5/60s) |
| `/api/keys/list` | GET | Lista kluczy |
| `/api/keys/{id}` | DELETE | Usun klucz |
| `/auth/logout` | POST | Wylogowanie (WorkOS + KV) |

### Billing proxy (chronione, forwarded do mcp-token-system via Service Binding)

| Sciezka | Metoda | Forward do |
|---------|--------|------------|
| `/api/billing/checkout` | POST | `/checkout/create` |
| `/api/billing/user` | GET | `/auth/user` |
| `/api/billing/transactions` | GET | `/user/transactions` |

**Dlaczego proxy?** Cookie `SameSite=Lax` nie jest wysylane na cross-origin POST. Same-origin proxy omija ten problem. Proxy buduje body od nowa (nie czyta `request.body` — ReadableStream jest jednorazowy w Workers).

## 4. STRUKTURA PLIKOW

```
src/
├── index.ts                    — Router glowny + billing proxy
├── types.ts                    — Interfejsy: User, AuthResult
├── apiKeys.ts                  — Generowanie/walidacja kluczy wtyk_*
├── workos-auth.ts              — WorkOS: auth URL, callback, sesje
├── middleware/
│   ├── authMiddleware.ts       — Middleware chronionych tras (cookie → KV)
│   └── rateLimit.ts            — Rate limiting (fail-open)
├── routes/
│   ├── userinfo.ts             — /oauth/userinfo (API key + AuthKit JWT)
│   ├── customAuth.ts           — Magic Auth (send-code, verify-code)
│   ├── apiKeySettings.ts       — CRUD kluczy API
│   ├── connectAuth.ts          — AuthKit standalone connect
│   ├── accountSettings.ts      — Strona ustawien konta
│   └── staticPages.ts          — Root, pricing, privacy, terms
├── utils/
│   ├── escapeHtml.ts           — Ochrona XSS
│   └── safeRedirect.ts         — Ochrona open redirect
└── views/
    ├── index.ts                — Barrel export szablonow
    ├── customLoginPage.ts      — Formularz Magic Auth
    ├── components/             — head.ts, layout.ts, styles.ts
    └── templates/
        ├── auth/               — loginSuccess.ts, logoutSuccess.ts
        ├── dashboard/          — dashboard.ts, settings.ts
        └── public/             — unifiedAuth.ts, pricing.ts
```

## 5. BAZA DANYCH D1 (mcp-oauth)

Binding: `TOKEN_DB` | ID: `eac93639-d58e-4777-82e9-f1e28113d5b2`

### Tabela `users`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `user_id` | TEXT PK | UUID (kanoniczny dla calej platformy) |
| `email` | TEXT UNIQUE | Adres email |
| `created_at` | TEXT | ISO8601 |
| `last_login_at` | TEXT | ISO8601 |
| `is_deleted` | INTEGER | 0=aktywny, 1=usuniety |
| `workos_user_id` | TEXT UNIQUE | Identyfikator WorkOS |

### Tabela `api_keys`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `api_key_id` | TEXT PK | UUID |
| `user_id` | TEXT FK | → users.user_id (CASCADE) |
| `api_key_hash` | TEXT UNIQUE | SHA-256 hash klucza |
| `key_prefix` | TEXT | Pierwsze 16 znakow (do wyswietlania) |
| `name` | TEXT | Nazwa nadana przez uzytkownika |
| `last_used_at` | INTEGER | Timestamp ostatniego uzycia |
| `created_at` | INTEGER | Timestamp utworzenia |
| `expires_at` | INTEGER | Opcjonalne wygasniecie |
| `is_active` | INTEGER | 1=aktywny, 0=uniewazn. |

### Tabela `account_deletions` (GDPR audit)
| Kolumna | Typ | Opis |
|---------|-----|------|
| `deletion_id` | TEXT PK | UUID |
| `user_id` | TEXT FK | → users.user_id |
| `original_email` | TEXT | Email w momencie usuniecia |
| `deletion_reason` | TEXT | Opcjonalny powod |
| `deleted_at` | TEXT | ISO8601 |
| `deleted_by_ip` | TEXT | IP zadania |

## 6. SESJE

- KV key: `workos_session:{token}` → JSON `{ user_id, email, expires_at }`
- TTL: 72 godziny
- Cookie: `workos_session=...; Domain=.wtyczki.ai; Path=/; HttpOnly; Secure; SameSite=Lax`
- `Domain=.wtyczki.ai` — oba workery (panel + api) moga czytac

## 7. UWIERZYTELNIANIE `/oauth/userinfo`

Dwie metody:
1. **API Key** (`Bearer wtyk_...`) → SHA-256 hash → lookup w D1
2. **AuthKit JWT** (`Bearer eyJ...`) → weryfikacja JWKS z AuthKit

Odpowiedz (200):
```json
{ "sub": "uuid-user-id", "email": "user@example.com" }
```

To jest endpoint ktory `mcp-token-system` wywoluje aby zidentyfikowac uzytkownika.

## 8. SEKRETY (produkcja)

| Nazwa | Opis |
|-------|------|
| `WORKOS_API_KEY` | WorkOS API key |
| `WORKOS_CLIENT_ID` | WorkOS client ID |
| `AUTHKIT_DOMAIN` | `https://exciting-domain-65.authkit.app` |
| `RESEND_API_KEY` | Klucz do wysylki emaili (kody logowania) |

Ustawiane przez `wrangler secret put`. Nigdy w kodzie.

## 9. RATE LIMITING

| Binding | Limit | Cel |
|---------|-------|-----|
| `RATE_LIMIT_SEND_CODE` | 5 req/60s per email | Magic Auth send-code |
| `RATE_LIMIT_VERIFY_CODE` | 10 req/60s | Magic Auth verify-code |
| `RATE_LIMIT_API_KEYS` | 5 req/60s per user | CRUD kluczy API |

Strategia: fail-open (jesli rate limiter nie odpowiada, przepuszcza ruch).

## 10. BEZPIECZENSTWO

- **XSS**: `escapeHtml()` / `escapeJs()` w `utils/escapeHtml.ts`
- **Open redirect**: `safeRedirectPath()` w `utils/safeRedirect.ts`
- **CSRF**: Tokeny dla Magic Auth
- **API keys**: Hashowane SHA-256, przechowywany tylko hash
- **Cookie**: `HttpOnly; Secure; SameSite=Lax`
- **SQL**: Prepared statements z `.bind()`, nigdy string concat

## 11. MCP SERVERS — KONSULTUJ PRZED KODEM

```
Cloudflare MCP: search_cloudflare_documentation  → Workers, D1, KV, wrangler.toml
WorkOS MCP:     workos_search, workos_docs        → AuthKit, MagicAuth, sesje
```

## 12. DEVELOPMENT

```bash
# Dev
npx wrangler dev

# Type check
npx tsc --noEmit

# Testy
npm test                              # wszystkie
npm run test:registration             # rejestracja
npm run test:api-keys                 # klucze API
npm run test:deletion                 # usuwanie konta
npm run test:oauth                    # OAuth
npm run test:database                 # baza danych

# Deploy (preferowany: push do main → Workers Builds auto deploy)
git push origin main

# Migracje D1 (ZAWSZE manualne)
npx wrangler d1 migrations apply mcp-oauth --remote   # produkcja
npx wrangler d1 migrations apply mcp-oauth --local    # lokalne
```

## 13. ZALEZNOSCI

| Pakiet | Wersja | Cel |
|--------|--------|-----|
| `@workos-inc/node` | ^8.9.0 | WorkOS SDK |
| `jose` | ^6.2.2 | JWT (AuthKit JWKS) |
| `wrangler` | ^4.77.0 | Cloudflare Workers CLI |
| `typescript` | ^6.0.2 | Kompilator |
| `vitest` | ^4.1.1 | Testy |

## 14. WAZNE LEKCJE (UNIKAJ TYCH BLEDOW)

1. **SameSite=Lax blokuje cross-origin POST cookies** — dlatego billing proxy jest same-origin
2. **`request.body` w Workers jest jednorazowy** (ReadableStream) — proxy buduje body od nowa
3. **Service Binding: `env.SERVICE.fetch(url, init)`** nie `fetch(new Request())` — TypeError
4. **Cloudflare Access paths MUSZA miec leading `/`** — bez niego Access nie przechwytuje

## 15. RED FLAGS — ZATRZYMAJ SIE I ZAPYTAJ

- Chcesz modyfikowac schemat D1 (dane produkcyjne!)
- Chcesz zmienic format `user_id` (UUID wspolny z mcp-token-system)
- Chcesz usunac plik ktory wydaje sie nieuzywany
- Chcesz zmienic logike `/oauth/userinfo` (serce auth calej platformy)
- Chcesz zmienic cookie domain/flags (wplywa na oba workery)

---
*Stan: po integracji auth + billing proxy (2026-03-25) | Wersja: 2.0*
