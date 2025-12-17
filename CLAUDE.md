This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cloudflare Workers application** that implements an OAuth for MCP (Model Context Protocol) servers. It provides a simple way to authenticate and authorize MCP servers to access user data. 

### Technology Stack

- **Platform:** Cloudflare Workers (Serverless)
- **Language:** TypeScript
- **Database:** Cloudflare D1
- **Package Manager:** npm


### 🚨 CRITICAL: Available MCP Servers for Documentation

**YOU HAVE ACCESS TO SPECIALIZED MCP SERVERS**

This project has access to two critical MCP servers that provide real-time documentation and prevent hallucinations:

#### 1. **Cloudflare MCP Server**
- **Purpose:** Official Cloudflare documentation for Workers, D1, KV, Durable Objects, etc.
- **When to use:** ANY time you're writing or modifying Cloudflare Workers code, database queries, configuration, or deployment scripts
- **Why critical:** Prevents outdated patterns, ensures correct API usage, provides accurate code examples
- **Available tools:**
  - `search_cloudflare_documentation` - Search Cloudflare docs for specific topics
  - `migrate_pages_to_workers_guide` - Migration guides (if needed)

#### 2. **WorkOS MCP Server**

Typically, LLMs using the WorkOS MCP Documentation server will follow a progressive discovery workflow when. your query is related to WorkOS:

Search first – Use workos_search with your error message, method name, or concept
Targeted fetch – Get the full document, example, or changelog using the path from your search results
Iterate – Repeat until you have the context you need
No more guessing directory structures or hunting through documentation sidebars.

Example Usage

// Find docs about SAML errors
workos_search({ query: "invalid SAML response" })

// Get SSO implementation examples
workos_examples({ example: "sso" })

// Check what's new in the platform
workos_changelogs({ package: "workos-platform" })

// Read specific documentation
workos_docs({ path: "sso/overview" })

---

## 3. Database Schema

**Three main tables:**

1. **users** - OAuth user accounts
   - Primary key: `user_id` (TEXT, UUID)
   - Unique constraint: `email`
   - Fields: user_id, email, created_at, last_login_at, is_deleted, deleted_at, workos_user_id
   - Purpose: Store user profiles from WorkOS OAuth

2. **api_keys** - Permanent API keys for MCP clients
   - Primary key: `api_key_id` (TEXT, UUID)
   - Foreign key: `user_id` → users(user_id) ON DELETE CASCADE
   - Purpose: Alternative authentication method for OAuth 2.1

3. **account_deletions** - GDPR audit trail
   - Primary key: `deletion_id` (TEXT, UUID)
   - Foreign key: `user_id` → users(user_id)
   - Purpose: Audit log for account deletions

---

## 4. CLOUDFLARE ACCESS CONFIGURATION

> **💡 TIP:** Before configuring Cloudflare Access, search Cloudflare MCP: "Cloudflare Access application paths"

### 4.1 Protected Paths Configuration

**CRITICAL REQUIREMENT: All path patterns MUST start with a leading slash (`/`).**

**Correct Configuration:**

| Input method | Subdomain | Domain | Path |
|---|---|---|---|
| Subdomain | `panel` | `wtyczki.ai` | `/dashboard` |
| Subdomain | `panel` | `wtyczki.ai` | `/user/*` |
| Subdomain | `panel` | `wtyczki.ai` | `/auth/*` |

**Common Mistake:**
```
❌ WRONG: dashboard*, user/*, auth/*  (missing leading slash)
✅ CORRECT: /dashboard, /user/*, /auth/*  (with leading slash)
```

**Why this matters:**
- Without the leading `/`, Cloudflare Access won't intercept requests
- Users will see authentication errors instead of OTP login
- Requests go directly to Worker without JWT validation
- This is the #1 cause of "authentication not working" issues

### 4.2 Testing Cloudflare Access

**Test protected routes:**
```bash
# Should redirect to Cloudflare Access OTP login
curl -I https://panel.wtyczki.ai/dashboard

# Should show public home page (no redirect)
curl -I https://panel.wtyczki.ai/
```

**Expected behavior:**
- `/dashboard` → 302 redirect to Cloudflare Access login
- `/` → 200 OK with public HTML page

---

## 5. DEVELOPMENT WORKFLOW

### 5.1 Deployment

**⚠️ IMPORTANT: This project uses Cloudflare Workers Builds with GitHub integration.**

**Primary Deployment Method (PREFERRED):**

This repository is connected to Cloudflare via **GitHub integration** (Workers Builds), which provides:
- ✅ **Automatic deployment** on push to `main` branch
- ✅ **Pull request comments** with build status and preview URLs
- ✅ **GitHub check runs** for monitoring deployments
- ✅ **No manual commands required** - just push to GitHub!

**To deploy changes:**
```bash
git add .
git commit -m "Your changes"
git push origin main
```

---

**Database Migrations:**

Database migrations must be applied manually (not automated):

```bash
# Apply to production
npx wrangler d1 migrations apply mcp-oauth --remote

# Apply to local development
npx wrangler d1 migrations apply mcp-oauth --local
```

**Why manual migrations?**
- Prevents accidental schema changes
- Allows review before production deployment
- Ensures data integrity
- Follows database best practices

---
