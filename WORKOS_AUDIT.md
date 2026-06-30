# Audyt WorkOS — `mcp-oauth` (panel.wtyczki.ai)

> Zakres: cały worker `oauth-provider` przez pryzmat integracji WorkOS.
> Kryteria: (1) aktualność względem najnowszych standardów WorkOS, (2) zgodność z best practices.
> Data: 2026-06-30 · Źródła: WorkOS MCP docs + changelog (`workos-platform`, Node SDK v8 / 2026-01-22).
> Charakter: raport + rekomendacje. **Bez zmian w kodzie** — wdrożenie po Twojej akceptacji.

---

## 1. Werdykt ogólny

Integracja jest **zgodna z aktualnym, rekomendowanym wzorcem WorkOS dla MCP** i nie zawiera
przestarzałych API. Weryfikacja tokenów, discovery endpoints, `WWW-Authenticate`, logout po `sid`
oraz Standalone Connect odpowiadają 1:1 dzisiejszej dokumentacji. Znaleziska to głównie **odstępstwa
od best practices** (cykl życia sesji, sposób wywołania Magic Auth) i drobne nieefektywności — żadne
nie jest krytyczną luką auth, bo realna granica auth żyje lokalnie we flocie (JWKS), a `mcp-oauth`
jest źródłem tożsamości + limitów.

| Obszar | Ocena |
|--------|-------|
| Aktualność SDK / API (brak deprecations) | ✅ Bardzo dobra |
| Wzorzec weryfikacji tokenów MCP | ✅ Wzorcowy |
| Discovery / metadata / WWW-Authenticate | ✅ Wzorcowy |
| Cykl życia sesji (access/refresh token) | ⚠️ Świadome odstępstwo — patrz F2 |
| Wywołanie Magic Auth | ⚠️ Poza SDK + ryzyko podwójnego maila — F1 |
| Spójność stanu usera (`is_deleted`) | ⚠️ Niespójność — F3 |
| Drobne nieefektywności | 🔵 Kosmetyka |

---

## 2. Aktualność — co jest zgodne z najnowszym standardem (potwierdzone w dokumentacji)

- **`@workos-inc/node@^8.9.0`** — najnowszy major. Node SDK v8 (changelog 2026-01-22: PKCE +
  runtime compatibility) to aktualna linia. Nazwa pakietu poprawna, brak deprecated importów.
- **Weryfikacja JWT** (`authenticateBearer.ts`): `createRemoteJWKSet(new URL('{authkit}/oauth2/jwks'))`
  + `jwtVerify(token, JWKS, { issuer: authkitDomain })` — **dokładnie** wzorzec z `authkit/mcp`
  → *Token Verification*. JWKS cache'owany per domena. ✅
- **`/.well-known/oauth-protected-resource`** (`index.ts:85`) i **proxy `oauth-authorization-server`**
  (`index.ts:103`) — zgodne z sekcjami *Metadata* i *Compatibility* w `authkit/mcp`. ✅
- **`WWW-Authenticate: Bearer ... resource_metadata="..."`** (`userinfo.ts:12`) — zgodny z RFC 9728
  i przykładem WorkOS (challenge z `resource_metadata`). ✅
- **Logout po `sid` z JWT** (`workos-auth.ts:221-232`) — `decodeJwt(access_token).sid` →
  `getLogoutUrl({ sessionId })`. Identyczne z przykładem w `authkit/sessions` → *Signing Out*. ✅
- **Standalone Connect** (`connectAuth.ts:51`): POST `/authkit/oauth2/complete` z `external_auth_id`
  — zgodny z `authkit/mcp` → *Standalone MCP OAuth*. ✅
- **`getAuthorizationUrl({ provider: 'authkit', ... })`** i **`authenticateWithCode`** — aktualne
  metody `userManagement`. ✅

> Wniosek aktualnościowy: **brak długu wersyjnego i brak użycia wycofanych endpointów.**

---

## 3. Znaleziska (best practices)

### 🟠 F1 — Magic Auth przez surowy `fetch` zamiast SDK + ryzyko podwójnego e-maila
**Plik:** `src/routes/customAuth.ts:99-123`

Kod tworzy kod Magic Auth surowym `fetch('https://api.workos.com/user_management/magic_auth')`,
po czym **sam** wysyła e-mail przez Resend (`sendVerificationEmail`, linia 123), odczytując
`magicAuth.code` z odpowiedzi.

Dwa problemy:

1. **Niespójność z resztą kodu i ominięcie SDK.** Weryfikacja używa już SDK
   (`workos.userManagement.authenticateWithMagicAuth`, linia 231), ale tworzenie kodu — nie.
   WorkOS udostępnia `workos.userManagement.createMagicAuth({ email })` (Node SDK, potwierdzone
   w `reference/authkit/magic-auth/create`). Surowy `fetch` pomija retry/wersjonowanie SDK i musi
   ręcznie budować nagłówki auth.
2. **Ryzyko podwójnej wysyłki maila.** Endpoint `POST /user_management/magic_auth` jest w docs
   oznaczony `sendsEmail: true` — **WorkOS domyślnie wysyła własny e-mail z kodem**. Jednocześnie
   wysyłasz własny e-mail przez Resend z `magicAuth.code`. Jeśli w Dashboardzie nie skonfigurowano
   *Custom Email Provider* (`authkit/custom-email-providers`) ani nie wyłączono maili WorkOS dla
   Magic Auth, **user dostaje dwa maile** (WorkOS + Resend).

**Rekomendacja:**
- Zamień surowy `fetch` na `workos.userManagement.createMagicAuth({ email })`.
- **Zweryfikuj w WorkOS Dashboard**, czy WorkOS nie wysyła własnego maila Magic Auth (sekcja email /
  custom email provider). Jeśli wysyła — albo wyłącz mail WorkOS i zostań przy Resend (spójny
  branding PL, który już masz), albo zrezygnuj z Resend i użyj szablonów WorkOS. Docelowo:
  **jedno źródło maila.**
- Uwaga edge-case: poleganie na `code` z odpowiedzi API działa, ale wiąże Cię z tym, że WorkOS
  zwraca kod w plaintext w body — przy custom email provider WorkOS to wspierany wzorzec; warto to
  świadomie udokumentować.

---

### 🟠 F2 — Cykl życia sesji odbiega od modelu WorkOS (brak walidacji/refresh access tokena)
**Pliki:** `src/workos-auth.ts:104-119` (zapis), `src/workos-auth.ts:131-179` (walidacja)

Po zalogowaniu zapisujesz w KV `access_token` + `refresh_token`, ale sesja to **własny, opaque
token (UUID) z twardym TTL 72h**. Access token nie jest walidowany per request (poza wyłuskaniem
`sid` przy logout), a `refresh_token` **nigdy nie jest używany** — jest martwym polem.

Dokumentacja `authkit/sessions` rekomenduje: krótki access token (JWT) walidowany na każdym żądaniu
+ odświeżanie przez `authenticateWithRefreshToken`, dzięki czemu zmiany po stronie WorkOS
(zakończenie sesji w Dashboard, *Inactivity timeout*, *Maximum session length*, dezaktywacja usera)
**propagują się szybko**.

**Konsekwencja realna:** sesja panelu żyje do 72h niezależnie od stanu po stronie WorkOS. Jeśli
admin zakończy sesję usera w WorkOS albo zadziała inactivity timeout — panel `mcp-oauth` i tak
wpuści usera aż do wygaśnięcia cookie/KV. Dla darmowego panelu tożsamości to akceptowalny
kompromis, ale to **świadome odstępstwo, nie best practice**.

**Rekomendacja (do decyzji, nie pilne):**
- **Wariant minimalny:** skoro `refresh_token` nie jest używany, **nie zapisuj go w KV** (mniej
  wrażliwych danych w spoczynku). Trzymaj tylko to, czego realnie używasz (`user_id`, `email`,
  `workos_user_id`, ewentualnie `access_token` na potrzeby `sid` przy logout).
- **Wariant zgodny z WorkOS:** skróć TTL sesji panelu i odświeżaj przez
  `userManagement.authenticateWithRefreshToken` (pamiętając o **rotacji** refresh tokena — docs:
  „Refresh tokens may be rotated after use"). To podnosi responsywność na rewokację, ale zwiększa
  złożoność — uzasadnione tylko jeśli zależy Ci na szybkim wygaszaniu sesji.
- Decyzja należy do Ciebie — oba warianty są legalne; obecny model po prostu udokumentuj jako
  „opaque 72h session, brak propagacji rewokacji WorkOS".

---

### ✅ F3 — Niespójna obsługa `is_deleted` — **WDROŻONE (2026-06-30)**
**Plik:** `src/workos-auth.ts:263-275` (`getUserById`) vs `src/auth/authenticateBearer.ts:45-47`

> **Status: naprawione.** Walidacja wykazała, że filtr wolno dodać **wyłącznie** do `getUserById`
> (ścieżka `validateSession`), bo `getUserByEmail`/`getUserByWorkosId` służą `getOrCreateUser` i pod
> `UNIQUE` (email + workos_user_id) filtr łamałby ponowne logowanie. Zmieniono `getUserById` →
> `WHERE user_id = ? AND is_deleted = 0` + komentarz. Przy okazji (item 2) ten sam filtr dodano w
> `connectAuth.ts` (Standalone Connect czyta KV bez `validateSession`). Patrz sekcja
> **7. Changelog wdrożeniowy**. Poniższy opis zachowany jako kontekst pierwotnego znaleziska.

`authenticateBearer` filtruje `... AND is_deleted = 0` (Bearer/JWT). Natomiast `getUserById`
używany przez `validateSession` (cookie panelu) **nie filtruje `is_deleted`**. Również
`getUserByEmail` / `getUserByWorkosId` w tym pliku nie sprawdzają tej flagi.

**Konsekwencja:** user oznaczony jako usunięty (`is_deleted = 1`), który ma jeszcze ważne cookie
sesji (do 72h, patrz F2), **zachowuje dostęp do `/dashboard`, `/auth/user`, `/dashboard/settings`**.
Bezpośrednio dotyka to GDPR/usuwania konta (tabela `account_deletions` istnieje, więc usuwanie to
realny przepływ).

**Rekomendacja:** dodaj `AND is_deleted = 0` do zapytań w `workos-auth.ts` (`getUserById`,
`getUserByEmail`, `getUserByWorkosId`) — spójnie z `authenticateBearer`. To zmiana logiki auth
panelu → zgodnie z regułami repo: **najpierw potwierdź ze mną, potem wdrożę.**

---

### 🔵 F4 — `updateUser({ locale: 'pl' })` przy każdym logowaniu (callback)
**Plik:** `src/workos-auth.ts:88-96`

Na każdym callbacku robisz dodatkowy round-trip do WorkOS, żeby ustawić `locale: 'pl'`, nawet gdy
locale już jest ustawione. Błąd jest połykany (`console.warn`).

**Rekomendacja:** ustawiaj locale **tylko przy tworzeniu usera** (gałąź „new user" w
`getOrCreateUser`) albo całkiem pomiń, jeśli locale i tak wymuszasz parametrem `&locale=pl` w URL
autoryzacji (`workos-auth.ts:62`). Oszczędza to jedno wywołanie API na każde logowanie.

---

### 🔵 F5 — `locale=pl` doklejane jako surowy query param
**Plik:** `src/workos-auth.ts:61-64`

`getAuthorizationUrl(...) + '&locale=pl'` działa, ale jest kruche (zakłada, że URL już ma `?`).
Komentarz słusznie zauważa, że SDK nie ma tego w interfejsie. Niski priorytet — jeśli zostawiasz,
rozważ budowę przez `URL`/`URLSearchParams` zamiast konkatenacji stringa. Przy okazji sprawdź, czy
nowszy Node SDK v8 nie dodał już `locale` do `getAuthorizationUrlOptions` (changelog v8 rozszerzał
opcje — warto zweryfikować w typach pakietu).

---

### 🔵 F6 — Nowy `WorkOS(...)` na każde wywołanie
**Pliki:** `workos-auth.ts:52,80,208`, `customAuth.ts:229`

Tworzysz instancję `WorkOS` per request. W modelu Workers (brak współdzielonego procesu między
żądaniami, brak poolingu) to akceptowalne i bezpieczne, ale lekko marnotrawne. Możesz utworzyć
klienta raz w obrębie obsługi żądania i przekazywać dalej. Czysto kosmetyczne.

---

### 🔵 F7 — Drobiazgi około-auth (nie-WorkOS, ale w przepływie logowania)
- **Parsowanie cookie** (`workos-auth.ts:251`): `split('=')` psuje wartości zawierające `=`.
  Tokeny to UUID, więc dziś bezpieczne; warto użyć `split('=').slice(1).join('=')` dla odporności.
- **Porównanie CSRF** (`customAuth.ts:42,174`): zwykłe `!==` (nie constant-time). Przy 600s TTL i
  rate-limitach ryzyko znikome; wzmianka dla kompletności.
- **`Path=/auth` dla cookie CSRF** (`customAuth.ts:132`) a formularze POST-ują na
  `/auth/login-custom/...` — ścieżka się zgadza (prefix `/auth`), OK. Zostawiam jako potwierdzenie,
  nie znalezisko.

---

## 4. Rekomendacje konfiguracyjne (WorkOS Dashboard — poza kodem)

Wynikają z aktualnych standardów MCP/AuthKit i wymagają tylko weryfikacji w Dashboardzie:

1. **CIMD (Client ID Metadata Document)** — od listopada 2025 to domyślny mechanizm identyfikacji
   klientów MCP (`authkit/mcp` → *Enabling CIMD*; changelog 2025-11-30). Upewnij się, że jest
   **włączony** w *Connect → Configuration*; DCR zostaw jako fallback dla starszych klientów. Repo
   ma `cimd.md`, więc temat znany — to tylko check „czy włączone".
2. **Sign-out redirect** — `getLogoutUrl({ returnTo: 'https://panel.wtyczki.ai/auth/logout-success' })`
   (`workos-auth.ts:231`) musi mieć ten URL na liście dozwolonych *Sign-out redirects* (sekcja
   *Redirect*), inaczej WorkOS odrzuci `returnTo`.
3. **Custom Email Provider / maile Magic Auth** — patrz F1: zdecyduj, kto wysyła mail (WorkOS czy
   Resend), żeby nie dublować.
4. **Session settings** — *Maximum session length / Inactivity timeout / Access token duration*
   (sekcja *Configuring Sessions*) są dziś w praktyce nieegzekwowane przez panel (F2). Jeśli
   zostajesz przy modelu 72h KV, miej świadomość, że te ustawienia Dashboardu nie wpływają na panel.

---

## 5. Priorytetyzacja wdrożenia

| # | Znalezisko | Priorytet | Zmiana auth? (wymaga Twojej zgody) |
|---|-----------|-----------|-------------------------------------|
| F3 | `is_deleted` w walidacji sesji | **Wysoki** (bezp./GDPR) | ✅ **WDROŻONE** |
| F1 | Magic Auth: SDK `createMagicAuth` (mail → krok Dashboard) | Średni | ✅ **WDROŻONE** (kod) |
| F2 | Martwy `refresh_token` usunięty z sesji KV | Średni | ✅ **WDROŻONE** (wariant minimalny) |
| F4 | `updateUser` locale tylko przy tworzeniu usera | Niski | ✅ **WDROŻONE** |
| F5 | `locale=pl` przez `URL`/`URLSearchParams` | Niski | ✅ **WDROŻONE** |
| F6 | Memoizowany klient WorkOS (`getWorkOS`) | Niski | ✅ **WDROŻONE** |
| F7 | Odporne parsowanie cookie + CSRF constant-time | Niski | ✅ **WDROŻONE** |

**Sugerowana kolejność:** F3 → (decyzja o F2) → F1 → F4 → reszta.

---

## 6. Czego NIE trzeba ruszać

- Wzorca weryfikacji JWT (`authenticateBearer`) — jest wzorcowy, nie modyfikuj „dla porządku".
- Endpointów discovery i `WWW-Authenticate` — zgodne z RFC i WorkOS.
- Logout po `sid` — poprawny.
- Wersji `@workos-inc/node` / `jose` — aktualne; nie podbijaj prewencyjnie bez powodu.

---

---

## 7. Changelog wdrożeniowy (2026-06-30)

Po audycie wdrożono **F3** oraz dwie powiązane poprawki wykryte podczas walidacji. `npx tsc --noEmit`
przechodzi czysto.

### 7.1 F3 — filtr `is_deleted` w walidacji sesji panelu
- `src/workos-auth.ts` → `getUserById`: `WHERE user_id = ?` → `WHERE user_id = ? AND is_deleted = 0`.
- **Celowo NIE** ruszono `getUserByEmail` / `getUserByWorkosId` (used by `getOrCreateUser`): pod
  `email UNIQUE` + `workos_user_id UNIQUE` filtr powodowałby kolizję `INSERT` przy ponownym logowaniu
  soft-deleted usera. Dodano komentarz wyjaśniający w kodzie.

### 7.2 Endpoint usuwania konta — był martwy (404), teraz zaimplementowany
**Wykryte podczas walidacji:** UI (`settings.ts:593`) POST-uje na `/account/delete/confirm`, ale
trasa nie istniała w `index.ts` → 404, a `is_deleted` nie był ustawiany przez nic w kodzie (cała
funkcja „usuń konto" nieczynna). Zaimplementowano zgodnie z kontraktem `pre_testing/account-deletion`:
- `src/routes/accountSettings.ts` → nowy `handleAccountDeletion()`: ownership guard (userId + email
  z sesji), atomowy `D1.batch([audit INSERT, soft-delete UPDATE])`, czyszczenie sesji KV + kasowanie
  cookie. **Soft delete** (`is_deleted=1, deleted_at`) — dane usera zachowane (zgodnie z testem D1.1);
  wpis GDPR do `account_deletions` z `original_email` + IP (`CF-Connecting-IP`). **Bez** kasowania
  usera z WorkOS i **bez** anonimizacji (kontrakt tego nie wymaga).
- `src/middleware/authMiddleware.ts` → `/account/delete` dodane do `PROTECTED_ROUTES`.
- `src/index.ts` → rejestracja `POST /account/delete/confirm` + import handlera.

### 7.3 Standalone Connect — filtr `is_deleted` (item 2)
- `src/routes/connectAuth.ts`: po odczycie sesji z KV (ścieżka omija `validateSession`) dodano
  lookup `... WHERE user_id = ? AND is_deleted = 0`; soft-deleted user nie dokończy flow OAuth nawet
  z żywym cookie.

### 7.4 Uwaga o testach `npm run test:deletion`
5 z 24 testów w `pre_testing/account-deletion` **pada — to stan zastany**, niezależny od tych zmian
(zweryfikowane: identyczny wynik na czystym `HEAD`). Testy odpytują **mock DB** (`test-utils.ts`)
bezpośrednio i nie importują handlera; mock nie emuluje `UPDATE ... SET is_deleted`. Realny handler
działa na D1, nie na mocku. Naprawa mocka = osobne zadanie (poza zakresem tego audytu).

---

## 8. Changelog wdrożeniowy — runda 2 (2026-06-30): F1, F2, F4–F7

`npx tsc --noEmit` czysto. Pełny `npm test`: **12 failed = stan zastany** (identycznie na czystym
`HEAD`; mock DB + flaky testy timestampów) — **zero regresji** z tych zmian.

### 8.1 F6 — memoizowany klient WorkOS (fundament)
- **Nowy plik** `src/utils/workosClient.ts` → `getWorkOS(apiKey)`: jedna instancja per isolate,
  memoizowana po kluczu API (rotacja sekretu podchwytywana bez restartu). Klient WorkOS jest
  bezstanowy (brak połączeń), więc reuse jest bezpieczny.
- Zastąpiono **wszystkie** `new WorkOS(...)` (5 call-site'ów: `workos-auth.ts` ×3, `customAuth.ts` ×2).

### 8.2 F1 — Magic Auth przez SDK `createMagicAuth`
- `src/routes/customAuth.ts`: surowy `fetch('https://api.workos.com/user_management/magic_auth')`
  → `workos.userManagement.createMagicAuth({ email })`. Zachowano polski mail przez Resend
  (`magicAuth.code`). Behawioralnie identyczne (ten sam endpoint), ale przez SDK (retry/wersjonowanie).
- ⚠️ **Krok Dashboard (poza kodem):** endpoint domyślnie wysyła też **własny mail WorkOS** →
  ryzyko podwójnej wiadomości. Aby zostawić tylko mail Resend: w WorkOS Dashboard wyłącz mail
  Magic Auth / skonfiguruj *Custom Email Provider*. Dodano komentarz ostrzegawczy w kodzie.

### 8.3 F2 — usunięty nieużywany `refresh_token` (wariant minimalny / data minimization)
- `refresh_token` był zapisywany w KV, ale **nigdzie nieczytany** → usunięty z zapisu sesji
  (`workos-auth.ts` `handleCallback`, `customAuth.ts` verify) oraz z interfejsów (`WorkOSSession`,
  `KVSession`). `access_token` **zostaje** — używany przez `getLogoutUrl` (claim `sid`).
- **Świadomie NIE** wdrożono pełnego modelu sesji WorkOS (krótki access token + refresh +
  propagacja rewokacji). Model „opaque 72h KV" pozostaje — to nadal decyzja architektoniczna do
  ewentualnej osobnej rundy (patrz opis F2 wyżej). Stare sesje w KV mają zbędne pole `refresh_token`
  do wygaśnięcia TTL — nieczytane, bez wpływu.

### 8.4 F4 — `updateUser(locale)` tylko dla nowego usera
- `workos-auth.ts` `handleCallback`: `getOrCreateUser` zwraca `isNewUser`; `updateUser({locale:'pl'})`
  wołane teraz **tylko** gdy `isNewUser` → eliminuje dodatkowy round-trip do WorkOS przy każdym logowaniu.

### 8.5 F5 — `locale=pl` bez konkatenacji stringa
- `getAuthorizationUrl`: zamiast `` `${url}&locale=pl` `` → `new URL(...)` + `searchParams.set('locale','pl')`.
  Potwierdzono w typach SDK v8.9.0, że `getAuthorizationUrl` **nie** ma opcji `locale` — query param
  pozostaje właściwym podejściem, ale teraz odpornym na obecność `?`.

### 8.6 F7 — odporne cookie + CSRF constant-time
- `getSessionTokenFromRequest`: split cookie po **pierwszym** `=` (wartości z `=` przetrwają).
- CSRF: nowy `timingSafeEqual()` w `customAuth.ts`; oba sprawdzenia (`send-code`, `verify-code`)
  używają porównania w stałym czasie zamiast `!==`.

---

*Raport: audyt na podstawie `src/**`, `wrangler.toml` oraz WorkOS MCP docs/changelog. Sekcja 1–6 to
stan z audytu; sekcja 7 dokumentuje wdrożone poprawki (F3 + endpoint usuwania + connectAuth).*
