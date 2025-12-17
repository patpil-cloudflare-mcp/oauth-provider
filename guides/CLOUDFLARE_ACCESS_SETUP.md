# Cloudflare Access Setup Guide

## What We Just Implemented

✅ **Code changes complete!** The authentication system is now ready to use Cloudflare Access. Here's what changed:

1. ✅ Removed hardcoded test user bypass from `src/index.ts`
2. ✅ JWT validation already configured in `src/auth.ts` (uses `jose` library)
3. ✅ Environment variables placeholders added to `wrangler.toml`

**Current status:** Code is ready, but requires Cloudflare Access configuration to function.

---

## Next Steps: Configure Cloudflare Access

To enable authentication and allow external testers to use the dashboard independently, follow these steps:

### Step 1: Enable One-time PIN Identity Provider

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Settings** → **Authentication**
3. Under **Login methods**, click **Add new**
4. Select **One-time PIN**
5. Click **Save**

**What this does:** Enables email + OTP authentication for your platform. Cloudflare automatically sends OTP emails from `noreply@notify.cloudflare.com`.

---

### Step 2: Create Access Application for Dashboard

1. In Zero Trust Dashboard, go to **Access** → **Applications**
2. Click **Create Application**
3. Choose **Self-hosted** application type
4. Configure the application:

   **Application Configuration:**
   - **Name:** `Wtyczki.ai Token Dashboard`
   - **Session duration:** `24 hours`
   - **Accept all available identity providers:** ✓ (checked)

5. **Add Public Hostnames** - Configure THREE protected paths:

   **🚨 CRITICAL: Paths MUST have leading slashes!**

   | Input method | Subdomain | Domain | Path |
   |---|---|---|---|
   | Subdomain | `panel` | `wtyczki.ai` | `/dashboard` |
   | Subdomain | `panel` | `wtyczki.ai` | `/user/*` |
   | Subdomain | `panel` | `wtyczki.ai` | `/auth/*` |

   **Common Mistake:**
   - ❌ WRONG: `dashboard*`, `user/*`, `auth/*` (missing leading slash)
   - ✅ CORRECT: `/dashboard`, `/user/*`, `/auth/*` (with leading slash)

   **Why this matters:** Without the leading `/`, Cloudflare Access won't intercept requests and users will see authentication errors.

6. Click **Next** to configure policies

---

### Step 3: Create Access Policy (Allow All Users)

1. On the **Add policies** page, configure:

   **Policy Configuration:**
   - **Policy name:** `Allow All Users`
   - **Action:** `Allow`
   - **Session duration:** `24 hours`

2. Under **Configure rules**, select:
   - **Rule type:** `Include`
   - **Selector:** `Emails ending in`
   - **Value:** `@*` (wildcard - allows any email domain)

3. Click **Next**, then **Add application**

**What this does:** Allows anyone with any email address to authenticate. On first login, the system auto-creates their account.

---

### Step 4: Get Configuration Values

After creating the Access application, you need two values:

#### 4a. Get Team Domain

1. In Zero Trust Dashboard, go to **Settings** → **Custom Pages**
2. Look for **Team domain** (e.g., `yourteam.cloudflareaccess.com`)
3. Copy the full URL: `https://yourteam.cloudflareaccess.com`

#### 4b. Get Application AUD Tag

1. Go to **Access** → **Applications**
2. Click on your **Wtyczki.ai Token Dashboard** application
3. Select the **Basic information** tab
4. Copy the **Application Audience (AUD) Tag** (long string like `9abc123...`)

---

### Step 5: Update Environment Variables

1. Open `wrangler.toml` in your project
2. Replace the empty placeholders with your values:

```toml
[vars]
ACCESS_TEAM_DOMAIN = "https://yourteam.cloudflareaccess.com"  # ← Your team domain
ACCESS_POLICY_AUD = "9abc123..."                               # ← Your AUD tag
```

3. Save the file

---

### Step 6: Deploy to Cloudflare

```bash
npx wrangler deploy
```

This deploys your Worker with the new authentication configuration.

---

## Testing the Authentication Flow

### Test 1: First User (Auto-Registration)

1. Visit `https://panel.wtyczki.ai/dashboard`
2. **Cloudflare Access intercepts** and shows login page
3. Enter your email address (any valid email)
4. Check your inbox for OTP code (expires in 10 minutes)
5. Enter the OTP code
6. You'll be redirected to the dashboard
7. Check the database - a new user should be created automatically

**Expected result:**
- New user created in database
- Stripe customer created
- Balance shows 0 tokens
- Can purchase tokens independently

### Test 2: Returning User

1. Visit `https://panel.wtyczki.ai/dashboard` again
2. Complete OTP flow with the same email
3. Should see your existing account with correct balance

**Expected result:**
- No duplicate user created
- Same user ID
- Balance preserved

### Test 3: Guest Checkout Flow (New User)

**This tests the complete guest-to-authenticated flow:**

1. Open incognito window
2. Visit `https://panel.wtyczki.ai` (public home page - NO auth required)
3. Enter test email in email field
4. Click "Kup teraz" on Plus package
5. Complete Stripe test payment (card: 4242 4242 4242 4242)
6. See success page with "🎉 Pierwsze zakupy!"
7. Click "Przejdź do panelu"
8. **Cloudflare Access should NOW intercept** (not before!)
9. Enter same email → Receive OTP → Enter code
10. See dashboard with 2000 tokens

**Expected result:**
- Account auto-created during payment
- Tokens already credited
- OTP login works on first attempt
- Dashboard shows correct balance

### Test 4: External Tester (Independent Account)

1. Send URL to external tester: `https://panel.wtyczki.ai`
2. They complete guest checkout with their email
3. They authenticate via OTP
4. They get their own account with separate balance

**Expected result:**
- Completely independent account
- Different user_id
- Separate token balance
- Can purchase without affecting your account

---

## Troubleshooting

### Problem: "No JWT token in request headers"

**Cause:** Cloudflare Access not configured or JWT not being sent.

**Solution:**
1. Verify Access Application is created and enabled
2. **Check that paths have leading slashes:**
   - Go to Zero Trust → Access → Applications
   - Click on your application
   - Verify paths show: `/dashboard`, `/user/*`, `/auth/*`
   - If missing `/`, edit and add it
3. Ensure environment variables are set correctly

### Problem: "JWT verification failed"

**Cause:** Incorrect `ACCESS_TEAM_DOMAIN` or `ACCESS_POLICY_AUD`.

**Solution:**
1. Double-check values in `wrangler.toml`
2. Ensure team domain includes `https://`
3. Verify AUD tag matches the Access application

### Problem: "Authentication required" error in browser

**Cause:** Authentication succeeded but user not created in database.

**Solution:**
1. Check Worker logs: `npx wrangler tail`
2. Look for "Creating new user for email..." message
3. Verify database connection is working

---

## Architecture: How It Works

```
┌─────────────────┐
│  User visits    │
│  /dashboard     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Cloudflare Access              │
│  (Shows Email + OTP login page) │
└────────┬────────────────────────┘
         │ (User enters email & OTP)
         ▼
┌─────────────────────────────────┐
│  Cloudflare validates OTP       │
│  Creates JWT token              │
│  Adds to request header         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Your Worker validates JWT      │
│  Extracts email from payload    │
│  Looks up user in database      │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌──────────────────┐
│ User  │  │ User NOT found:  │
│ found │  │ Auto-register    │
│       │  │ - Create user    │
│       │  │ - Create Stripe  │
│       │  │   customer       │
│       │  │ - Link both      │
└───┬───┘  └────────┬─────────┘
    │              │
    └──────┬───────┘
           │
           ▼
    ┌─────────────┐
    │  Show       │
    │  Dashboard  │
    └─────────────┘
```

---

## Security Features

✅ **Cloudflare-managed OTP delivery** - Battle-tested infrastructure
✅ **Automatic JWT signing key rotation** - Keys expire every 6 weeks
✅ **CSRF protection** - Built into Cloudflare Access
✅ **Rate limiting** - Handled by Cloudflare (5 failed attempts per 15 min)
✅ **Session expiration** - 24 hours, auto-expire
✅ **No passwords** - No password vulnerabilities

---

## Production-Ready Checklist

Before sending to external testers:

- [ ] Cloudflare Access Application created
- [ ] One-time PIN identity provider enabled
- [ ] Access Policy configured (Allow all emails)
- [ ] Environment variables set in `wrangler.toml`
- [ ] Worker deployed with `npx wrangler deploy`
- [ ] Tested login flow with your own email
- [ ] Verified user auto-registration in database
- [ ] Tested token purchase flow
- [ ] Verified separate accounts for different emails

---

## Support

If you encounter issues:

1. Check Worker logs: `npx wrangler tail`
2. Verify Cloudflare Access configuration in Zero Trust dashboard
3. Test JWT manually at [jwt.io](https://jwt.io)
4. Contact support: support@wtyczki.pl

---

## What's Next?

After authentication is working:

1. **Test with external users** - Send dashboard link to testers
2. **Monitor usage** - Check logs and database for activity
3. **Phase 4: OAuth for MCP servers** - Same authentication system, different flow
4. **Phase 5: Production hardening** - Add monitoring, error handling, rate limiting

**Current Status:** Ready for external testing after completing Step 1-6 above! 🚀
