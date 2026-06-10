# CLAUDE.md — mcp-oauth (panel.wtyczki.ai)

> Worker odpowiedzialny za tozsamosc uzytkownikow platformy wtyczki.ai.
> Przeczytaj tez `/mcp-monorepo/CLAUDE.md` (root) dla kontekstu calej platformy.

## 1. ROLA

Jedyne zrodlo tozsamosci. Zarzadza:
- Sesjami (WorkOS AuthKit + Magic Auth)
- Endpointem `/oauth/userinfo` (serce auth calej platformy)
- Endpointem `/oauth/userinfo-free` (auth + dzienne limity free MCP serverow)
- MCP discovery (`.well-known`)
- Dashboardem uzytkownika (HTML)

**Model platformy (od 2026-06-10):** wszystkie MCP servery sa darmowe z dziennym limitem
per user (FreeUsageLimiter DO). Billing tokenowy zostal usuniety z mcp-oauth, a workery
mcp-token-system (api.wtyczki.ai) i seo-ai usuniete z Cloudflare. Baza D1
`mcp-tokens-database` zostala jako archiwum historii platnosci.

## 2. STACK

| Element | Wartosc |
|---------|---------|
| Platform | Cloudflare Workers |
| Language | TypeScript 6.x |
| Database | D1 (`TOKEN_DB` binding) |
| KV | `USER_SESSIONS` (sesje) |
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
| `/oauth/userinfo` | GET | Zwraca `{ sub, email }` — AuthKit JWT |
| `/oauth/userinfo-free` | GET | Auth + atomowe pobranie 1 slotu z dziennego limitu free MCP servera. Wymaga `X-MCP-Server`. Zwraca `{ sub, email, remaining, reset_at }` lub 429. |
| `/.well-known/oauth-protected-resource` | GET | MCP discovery |
| `/.well-known/oauth-authorization-server` | GET | Proxy do AuthKit metadata |
| `/auth/login` | GET | Redirect do unified auth |
| `/auth/callback` | GET | WorkOS callback → tworzy sesje |
| `/auth/login-custom/send-code` | POST | Magic Auth — wyslij kod (rate limit: 5/60s) |
| `/auth/login-custom/verify-code` | POST | Magic Auth — weryfikuj kod (rate limit: 10/60s) |
| `/auth/connect-login` | GET | AuthKit Standalone Connect |
| `/auth/logout-success` | GET | Strona po wylogowaniu |
| `/privacy` | GET | Polityka prywatnosci |
| `/terms` | GET | Regulamin |
| `/public/*` | GET | Statyczne assety (logo) |

### Chronione (wymagaja sesji cookie)

| Sciezka | Metoda | Opis |
|---------|--------|------|
| `/auth/user` | GET | Info o uzytkowniku (JSON) |
| `/dashboard` | GET | Panel uzytkownika (HTML) |
| `/dashboard/settings` | GET | Ustawienia konta |
| `/auth/logout` | POST | Wylogowanie (WorkOS + KV) |

## 4. STRUKTURA PLIKOW

```
src/
├── index.ts                    — Router glowny
├── types.ts                    — Interfejsy: User, AuthResult
├── workos-auth.ts              — WorkOS: auth URL, callback, sesje
├── middleware/
│   ├── authMiddleware.ts       — Middleware chronionych tras (cookie → KV)
│   └── rateLimit.ts            — Rate limiting (fail-open)
├── routes/
│   ├── userinfo.ts             — /oauth/userinfo (AuthKit JWT)
│   ├── customAuth.ts           — Magic Auth (send-code, verify-code)
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
        └── public/             — unifiedAuth.ts
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

**AuthKit JWT** (`Bearer eyJ...`) → weryfikacja JWKS z AuthKit → mapowanie `workos_user_id` na kanoniczny `user_id` w D1. (Auth po kluczach API `wtyk_*` zostalo usuniete 2026-05-28.)

Odpowiedz (200):
```json
{ "sub": "uuid-user-id", "email": "user@example.com" }
```

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
| `FREE_USAGE_LIMITER` (DO) | per-server (domyślnie 20/day) per (user × server) | Daily limit free MCP serverów; reset o północy Warsaw (lazy) + alarm-cleanup (kasuje przeterminowane liczniki, by storage nie puchł) |

Strategia: fail-open (jesli rate limiter nie odpowiada, przepuszcza ruch).

### Free MCP server registry (`FREE_SERVERS` env var)

JSON map `{"<server-name>": <daily-limit>}` w `wrangler.toml`. Server musi być na liście, inaczej `/oauth/userinfo-free` zwraca 403. Dodanie nowego free servera = wpis + redeploy mcp-oauth (zero zmian schemy). Dokładny przepływ i wzorzec integracji po stronie serverów: `MCP_SERVER_INTEGRATION_GUIDE.md` sekcja "Free MCP Server Integration".

## 10. BEZPIECZENSTWO

- **XSS**: `escapeHtml()` / `escapeJs()` w `utils/escapeHtml.ts`
- **Open redirect**: `safeRedirectPath()` w `utils/safeRedirect.ts`
- **CSRF**: Tokeny dla Magic Auth
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

1. **SameSite=Lax blokuje cross-origin POST cookies** — cross-origin fetch z panelu wymaga same-origin proxy (tak dzialal usuniety billing proxy)
2. **`request.body` w Workers jest jednorazowy** (ReadableStream) — w proxy buduj body od nowa
3. **Service Binding: `env.SERVICE.fetch(url, init)`** nie `fetch(new Request())` — TypeError
4. **Cloudflare Access paths MUSZA miec leading `/`** — bez niego Access nie przechwytuje
5. **Free MCP servery NIE walidują tokenów lokalnie** — wszystkie idą przez `/oauth/userinfo-free` (rule #6 z root CLAUDE.md). Workers Rate Limiting binding ma `period` max 60s — daily limity wymagają DO (`FREE_USAGE_LIMITER`) z lazy reset (porównanie `getWarsawDateKey()`). **Reset = lazy; cleanup = alarm (2026-05-29).** Lazy reset zostaje (pewny przez DST), ale dochodzi JEDEN jednorazowy alarm na aktywną instancję (~1 min po północy → `deleteAll()` przeterminowanego licznika). To NIE jest „lawina N×30 eventów", której bała się pierwotna decyzja — to co najwyżej jeden alarm na instancję będącą w użyciu, hibernation-friendly, re-armowany tylko przy realnym `tryConsume`. Bez tego każda para `(user × server)`, która raz użyła limitu, trzymałaby ~12 KB metadanych SQLite w nieskończoność.

## 15. RED FLAGS — ZATRZYMAJ SIE I ZAPYTAJ

- Chcesz modyfikowac schemat D1 (dane produkcyjne!)
- Chcesz zmienic format `user_id` (UUID kanoniczny dla calej platformy)
- Chcesz usunac plik ktory wydaje sie nieuzywany
- Chcesz zmienic logike `/oauth/userinfo` (serce auth calej platformy)
- Chcesz zmienic cookie domain/flags (wplywa na oba workery)

---
*Stan: po usunieciu billingu tokenowego z panelu — model free + dzienne limity (2026-06-10) | Wersja: 2.2*
