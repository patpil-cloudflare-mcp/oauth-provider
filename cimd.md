Client ID Metadata Documents (CIMD): How OAuth client registration works in MCP
Scalable, stateless client registration for AI agents: using a URL as your OAuth client ID to access MCP servers.


Every OAuth flow starts with one prerequisite: the client (i.e., the app trying to access resources) must be registered with the authorization server and get a client_id to use in subsequent calls. This has traditionally be done either manually in a dashboard or programmatically using APIs.

This model breaks in open, high-scale ecosystems like the Model Context Protocol (MCP), where a single AI client may connect to thousands of MCP servers it has never seen before. MCP needs a way for clients to introduce themselves without forcing every server to maintain a registration database.

Client ID Metadata Documents (CIMD) are the OAuth Working Group’s answer: a web-native, stateless client identity mechanism where a URL is the client_id , and that URL hosts the client’s metadata as JSON. The approach is now adopted in MCP via SEP-991 and is the preferred default for MCP client registration starting with the 2025-11-25 spec.

This article is a deep dive into CIMD: what it is, why MCP moved to it, how to implement it, and what security checks matter.

What are Client ID Metadata Documents (CIMD)?
A Client ID Metadata Document is a JSON document hosted at a stable HTTPS URL controlled by the client. The document’s URL is used directly as the OAuth client_id . Authorization servers fetch that URL to learn the client’s metadata on demand.

So instead of a server minting a new client_id for every client via Dynamic Client Registration (DCR), CIMD flips the model:

Identity is web-based: If you control the domain, you control the client identity.
No preregistration required: Clients can appear in any ecosystem instantly.
No registration endpoint exists: Servers fetch metadata rather than accepting writes.
Think of it as “OAuth meets the web”: the address  the identity.

Why CIMD exists (the problem it solves)
OAuth assumes the authorization server already has a record for the client: a client_id, allowed redirect_uris, auth method, and so on. That’s fine for SaaS where clients register once in a portal.

MCP changes the game. MCP clients (AI apps, IDE helpers, agents) might connect to any MCP server on the internet, often with no prior relationship. The ecosystem needs a safe way for a client to say: “Here’s who I am and where to send the user back after auth.”

CIMD provides this introduction without requiring each server to store a permanent registration entry.

How CIMD works
1. Client hosts a metadata JSON document at an HTTPS URL it controls. For example, https://ai.example.com/oauth-client.json:

{
  "client_id": "https://ai.example.com/oauth-client.json",
  "client_name": "My MCP Client",
  "redirect_uris": ["https://ai.example.com/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "logo_uri": "https://ai.example.com/logo.png",
  "jwks_uri": "https://ai.example.com/jwks.json"
}
client_id: The client’s identifier. In CIMD, this must be the HTTPS URL where the metadata document is hosted, and it must exactly match the client_id used in the OAuth request. This is how the server binds the client’s identity to domain control.
client_name: Human-readable name for display in consent screens and logs (e.g., “My MCP Client”). Optional but strongly recommended for UX.
redirect_uris: List of allowed redirect/callback URLs for this client. During an auth request, the redirect_uri parameter must be one of these, or the server rejects the flow. This is the key protection against client impersonation/phishing.
grant_types: OAuth grant types the client intends to use at the authorization server (e.g., authorization_code, refresh_token, etc.). Servers use this to validate that the requested flow is acceptable for the client. In MCP, authorization_code (+ PKCE) is the normal/default choice.
response_types: The response types the client will ask for at the authorization endpoint. code corresponds to Authorization Code flow. This should line up with grant_types (e.g., if you list code, you should list authorization_code).
token_endpoint_auth_method: How the client authenticates to the token endpoint. Common values:
none = public client (no client secret; relies on PKCE). MCP commonly allows/encourages none for public clients, but confidential clients can declare stronger methods.
client_secret_basic / client_secret_post = secret-based auth
private_key_jwt = signed JWT with client’s private key
logo_uri: URL to a client logo that the authorization server may show on consent/approval screens. Optional, UX-only.
jwks_uri: URL to the client’s JSON Web Key Set. Required only if the client uses a key-based auth method (like private_key_jwt) or signs requests. The server fetches keys from here to verify the client’s signatures. Optional for public clients using token_endpoint_auth_method: "none". Example JWKS served at jwks_uri:
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key-1",
      "alg": "RS256",
      "n": "0vx7agoebG...",
      "e": "AQAB"
    }
  ]
}
2. Client uses that URL as its client_id in the OAuth authorization request. Example request:

GET https://auth.server.example/authorize?
  response_type=code&
  client_id=https%3A%2F%2Fai.example.com%2Foauth-client.json&
  redirect_uri=https%3A%2F%2Fai.example.com%2Fcallback&
  scope=mcp.tools.read%20mcp.resources.read&
  code_challenge=abc123...&
  code_challenge_method=S256&
  state=xyz
3. Authorization server fetches the URL, validates the metadata, and caches it.

‍4. OAuth continues normally (typically Authorization Code + PKCE in MCP).

Server-side validation rules
When an auth server receives a request with a URL client_id, it must fetch and validate the metadata document. Core checks include:

client_id must be HTTPS: No http://, no custom schemes for CIMD identity.
Content must be JSON: Parseable, no surprises, small and deterministic.
Document’s client_id must exactly match the URL used: Prevents bait-and-switch documents.
Requested redirect_uri must be in redirect_uris: This is the primary anti-impersonation guardrail.
Cache using normal HTTP semantics: Respect Cache-Control, ETag, etc. In high-traffic servers, pair HTTP caching with an eviction strategy (e.g., TTL/LRU) so the CIMD cache can’t grow without bound.
Servers typically cache fetched metadata so they don’t re-fetch on every auth request.

Example CIMD validation using Python:

# cimd_validate.py
import asyncio
import ipaddress
import json
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
import dns.asyncresolver

MAX_DOC_BYTES = 10 * 1024
FETCH_TIMEOUT = 3.0

@dataclass
class CacheEntry:
    expires_at: float
    etag: Optional[str]
    doc: Dict[str, Any]

cache: Dict[str, CacheEntry] = {}

def is_private_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
    )

async def assert_public_https_url(client_id: str):
    u = urlparse(client_id)

    if u.scheme != "https":
        raise ValueError("client_id must be an https URL")

    # DNS resolve and block private/loopback IPs (SSRF mitigation)
    res = await dns.asyncresolver.resolve(u.hostname, "A")
    for rdata in res:
        if is_private_ip(rdata.to_text()):
            raise ValueError("client_id resolves to a private/loopback IP")

    # Also check AAAA (IPv6)
    try:
        res6 = await dns.asyncresolver.resolve(u.hostname, "AAAA")
        for rdata in res6:
            if is_private_ip(rdata.to_text()):
                raise ValueError("client_id resolves to a private/loopback IP (IPv6)")
    except Exception:
        pass

def parse_max_age(cache_control: Optional[str]) -> Optional[int]:
    if not cache_control:
        return None
    parts = [p.strip() for p in cache_control.split(",")]
    for p in parts:
        if p.lower().startswith("max-age="):
            try:
                return int(p.split("=", 1)[1])
            except ValueError:
                return None
    return None

def validate_doc(doc: Dict[str, Any], client_id: str, requested_redirect: str):
    if not isinstance(doc, dict):
        raise ValueError("CIMD JSON must be an object")

    # 1) Document client_id must match URL used
    if doc.get("client_id") != client_id:
        raise ValueError("CIMD client_id does not match requested client_id")

    # 2) redirect_uris must be array of strings
    redirect_uris = doc.get("redirect_uris")
    if not isinstance(redirect_uris, list) or not all(isinstance(x, str) for x in redirect_uris):
        raise ValueError("CIMD redirect_uris must be an array of strings")

    # 3) requested redirect_uri must be in redirect_uris (exact match)
    if requested_redirect not in redirect_uris:
        raise ValueError("redirect_uri not allowed by CIMD")

    # Optional sanity checks
    for k in ("grant_types", "response_types"):
        if k in doc and not isinstance(doc[k], list):
            raise ValueError(f"{k} must be an array if present")

async def fetch_and_validate_cimd(client_id: str, requested_redirect: str) -> Dict[str, Any]:
    await assert_public_https_url(client_id)

    # Cache check
    now = asyncio.get_event_loop().time()
    entry = cache.get(client_id)
    if entry and entry.expires_at > now:
        validate_doc(entry.doc, client_id, requested_redirect)
        return entry.doc

    headers = {}
    if entry and entry.etag:
        headers["If-None-Match"] = entry.etag

    async with httpx.AsyncClient(follow_redirects=False, timeout=FETCH_TIMEOUT) as client:
        resp = await client.get(client_id, headers=headers)

    if resp.status_code == 304 and entry:
        validate_doc(entry.doc, client_id, requested_redirect)
        entry.expires_at = now + 60  # extend briefly
        return entry.doc

    if resp.status_code != 200:
        raise ValueError(f"failed to fetch CIMD: HTTP {resp.status_code}")

    ct = resp.headers.get("content-type", "")
    if "application/json" not in ct.lower():
        raise ValueError("CIMD content-type must be application/json")

    if len(resp.content) > MAX_DOC_BYTES:
        raise ValueError("CIMD document too large")

    try:
        doc = resp.json()
    except json.JSONDecodeError:
        raise ValueError("CIMD body is not valid JSON")

    validate_doc(doc, client_id, requested_redirect)

    # Honor HTTP caching
    max_age = parse_max_age(resp.headers.get("cache-control"))
    etag = resp.headers.get("etag")
    expires_at = now + max_age if max_age is not None else now + 300

    cache[client_id] = CacheEntry(expires_at=expires_at, etag=etag, doc=doc)
    return doc
Usage:

import asyncio
from cimd_validate import fetch_and_validate_cimd

doc = asyncio.run(
    fetch_and_validate_cimd(
        "https://ai.example.com/oauth-client.json",
        "https://ai.example.com/callback"
    )
)

print("Valid CIMD:", doc.get("client_name"))
Why CIMD fits MCP better than DCR
Your earlier post lays this out well; here’s the CIMD-focused version.

1. Stateless at internet scale
Dynamic Client Registration (DCR) turns every new client into a database write: the server has to create a record, assign a client_id, store redirect URIs, and often keep lifecycle state (revocation, expiration, updates). That model works when you have a small, known set of apps. In MCP, it breaks fast: an AI client can discover and connect to thousands of servers, and servers can’t realistically persist an ever-growing registry for clients they may never see again.

CIMD avoids that growth curve. Servers don’t “onboard” clients into a permanent store: they fetch the metadata when needed, validate it, and cache it with normal HTTP semantics. That keeps registration lightweight, reversible, and naturally bounded, which is exactly what open MCP ecosystems need.

2. No public write endpoint
DCR requires a registration endpoint anyone can POST to. In an open network, that endpoint becomes a high-value target: attackers can spam it with junk clients, force expensive validations, or probe implementation quirks. Even with authentication, you still need to defend a surface that’s fundamentally designed for untrusted writes.

CIMD removes that entire class of risk. There’s no registration API to attack because servers only perform read-only fetches to a client-controlled URL. You still need SSRF protections, but you’ve eliminated the bigger operational burden of maintaining a public “client creation” interface.

3. One stable client identity everywhere
With DCR, a client ends up with a different client_id per server, and sometimes a different secret too. That means the client has to store per-server credentials, handle rotation, and recover state across devices or installs. In MCP, where clients might connect opportunistically to many servers, this becomes a real UX and engineering tax.

CIMD gives clients a single, durable identity: the CIMD URL. The same client_id works across every MCP server, and the authoritative metadata lives in one place under the client’s control. That simplifies client implementation and makes interoperability much more predictable.

4. A web-native trust model
OAuth already leans on the web for trust anchors: issuers are URLs, discovery is URL-based, keys are fetched from URLs. CIMD extends that exact pattern to clients: if you control the domain hosting the metadata, you control the client identity.

This aligns cleanly with MCP’s internet-first posture. Instead of every server re-issuing identity, CIMD lets the client bring its own. Servers then verify the critical safety piece (redirect URIs) against that metadata, which is the right balance of decentralization and security for MCP.

CIMD and client impersonation (why it’s hard to phish)
A natural worry with CIMD is: “If the client_id is just a URL, what stops a malicious client from pretending to be a well-known app?”

At first glance, it seems easy to spoof. An attacker could send an authorization request claiming:

client_id = https://real-app.com/oauth-client.json
…but then ask to receive tokens at:

redirect_uri = https://evil-app.com/callback
In CIMD, that impersonation doesn’t work because the authorization server doesn’t trust the request alone: it fetches the real app’s metadata from the claimed client_id URL and validates it.

The real app’s CIMD includes its own redirect_uris, and the server requires an exact match between the requested redirect_uri and one of those registered values. Since https://evil-app.com/callback is not listed in the real app’s document, the server rejects the flow before any code or token is issued.

So CIMD shifts trust to something attackers can’t fake casually: domain control. Anyone can say they are another client, but unless they control that client’s domain (and thus its metadata and redirect URIs), they can’t complete the OAuth loop or receive credentials. In practice, this makes phishing via client spoofing dramatically harder because the attacker would need to compromise the legitimate client’s hosting origin, not just craft a clever request.

CIMD for confidential clients (no per-server secrets)
CIMD doesn’t force every client to be public. Confidential clients (like server-side web apps or managed agent backends) can still prove their identity strongly, they just don’t need a different secret from every MCP server. Instead of a server minting and storing a client_secret per client, CIMD lets the client advertise its authentication method and key material in its own metadata document.

The most common pattern is private_key_jwt. In the CIMD, the client sets:

token_endpoint_auth_method: "private_key_jwt"
and includes a public key via jwks or jwks_uri
When the client later calls the token endpoint, it signs a short-lived JWT with its private key and sends it as a client assertion. The authorization server fetches the client’s public key from jwks_uri (or uses the inline jwks) and verifies the signature. If the signature checks out and the JWT claims are correct (issuer/subject = client_id, audience = token endpoint, fresh exp), the server treats the client as authenticated and issues tokens.

This is a big operational win for MCP. Clients get one durable identity and one keypair that works across every MCP server that supports CIMD, instead of juggling per-server secrets that need storage, rotation, recovery, and revocation. And because the keys live in the metadata document, the client can rotate them centrally: update jwks_uri (or the JWKS itself) and every server will pick up the new key on the next fetch.

Security considerations for CIMD
CIMD closes some risks and introduces others. The big one is SSRF.

SSRF risk: “fetching a URL from strangers”
Because servers fetch client_id URLs supplied by arbitrary clients, malicious clients could try to make the server request internal resources.

Mitigations recommended in the draft and MCP discussions:

Block loopback and private IP ranges: Because the authorization server fetches a client_id URL supplied by an untrusted client, an attacker could point that URL at internal-only addresses (classic SSRF), like http://127.0.0.1, http://localhost, or RFC1918 space (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12), or cloud metadata IPs such as 169.254.169.254. The fix is to resolve the hostname and reject any URL whose destination is loopback, link-local, or private network space before fetching.
Only allow HTTPS: Requiring HTTPS prevents trivial on-path tampering of the metadata doc and ensures domain control is tied to TLS. It also removes a bunch of downgrade and caching edge cases that come with plaintext HTTP.
Enforce strict timeouts: Treat CIMD fetches like you would any untrusted outbound call: short connect/read timeouts (a couple seconds) so a malicious client can’t stall your authorization endpoint by hosting a slow or never-ending response.
Cap response size: CIMDs are tiny JSON files. Put a hard byte limit (e.g., 5–10KB) on the response body so clients can’t force memory/CPU blowups by returning huge payloads. If it exceeds the cap, fail closed.
Reject loopback/localhost redirect URIs in CIMD (e.g., http://localhost:*, http://127.0.0.1:*). Loopback callbacks are a common native-app OAuth pattern, but in CIMD they aren’t globally meaningful: an open MCP server can’t safely determine which local process will receive the redirect on a user’s machine. Allowing them would re-introduce redirect ambiguity (and potential capture/race risks), so CIMD requires publicly resolvable redirect URIs such as HTTPS app links or custom URI schemes.
Don’t follow redirects to private networks: Even if the original client_id URL is public, an attacker could return a 30x redirect to an internal IP. So if you allow redirects at all, you need to re-validate every hop with the same “public HTTPS + not private/loopback” rules — or simplest, disable redirects for CIMD fetches entirely.
Domain control ≠ reputation
CIMD proves something important but limited: the client controls the domain hosting the metadata. That’s a strong technical identity anchor, but it doesn’t say anything about whether the client is trustworthy, well-known, or safe. Anyone can buy a domain and publish a CIMD. So MCP servers still need policy on top of identity, like:

warning users about unknown domains
allowlisting approved publishers in enterprise deployments, or
requiring admin approval before granting sensitive scopes.
In other words, CIMD answers “is this client the one that controls this URL?”, not “should we trust this client with access?”.

Where CIMD sits in MCP’s registration order
MCP doesn’t force a single registration mechanism on every server. Instead, the spec defines a priority order that clients should follow so they can connect safely across both open and enterprise environments. The intent is: use the most explicit/trusted method available, and fall back to more dynamic ones only when needed.

In practice, the order looks like this:

Pre-registration (static clients): If the MCP server already knows the client (via an admin portal, allowlist, or manual setup) that takes priority. This path is common in enterprise deployments where client access is tightly controlled, and the server may want an explicit audit trail of approved apps.
CIMD (URL-based client identity): If there’s no static registration, MCP clients should next try CIMD. This is now the preferred dynamic default in the 2025-11-25+ MCP authorization flow: a client presents a URL client_id, the server fetches metadata, validates redirect URIs, and caches it. It gives open ecosystems a scalable, stateless “introduce yourself” model without a writeable registration endpoint.
Dynamic Client Registration (DCR): DCR remains supported for compatibility and for servers that want to mint per-server client IDs, but MCP positions it as a fallback. It’s useful when CIMD isn’t possible (e.g., the client can’t host stable HTTPS metadata) or when the server explicitly wants to issue local credentials. Some OAuth ecosystems still prefer DCR specifically because it produces a server-side registry and audit trail of clients, which can be valuable in regulated enterprise environments.
Manual user input / out-of-band: If none of the above are available, MCP allows a last-resort manual path where a user or developer copies client details in by hand. This is mainly to keep things interoperable in edge cases, not a happy-path for open networks.
So CIMD is the first “dynamic” option, with DCR as a fallback.

When CIMD might not be the right fit
Even though CIMD is a strong default, DCR or pre-registration can still make sense when:

You’re in a closed enterprise ecosystem where admins must approve each client.
The client can’t host stable HTTPS metadata (ultra-embedded / air-gapped environments).
You need a guaranteed server-side audit registry of registered clients.
Think “internal corporate agent platform,” not “open MCP marketplace.”

Implementation checklist
For MCP/OAuth clients
Pick a stable HTTPS URL you control.
Host a CIMD JSON document there.
Ensure the document contains:
client_id matching the URL
redirect_uris
appropriate grant_types / response_types
token_endpoint_auth_method
optional jwks_uri, logo_uri, etc.
Use that URL as client_id in the Authorization Code + PKCE flow.
For MCP/OAuth servers
Detect URL-style client_ids.
Fetch and validate metadata using the rules above.
Implement SSRF protections.
Cache with HTTP headers.
Enforce redirect URI allowlisting strictly.
Closing thought: CIMD is OAuth growing up for open ecosystems
The OAuth world is moving toward a more decentralized, web-native idea of identity. CIMD is a small change in wire format but a huge change in scalability and operational posture.

For MCP, it’s the path that keeps:

servers stateless,
client identity stable,
and dynamic registration safe at internet scale.
WorkOS supports MCP (and CIMD is already live)
If you’re building an MCP server and don’t want to re-implement OAuth from scratch, WorkOS already supports MCP natively. AuthKit can act as your OAuth 2.1 authorization server for MCP, handling PKCE, token minting, scopes/tool permissions, and the rest of the auth surface that the spec expects.

And importantly for this post: WorkOS now supports Client ID Metadata Documents (CIMD) for MCP auth. In other words, if an MCP client shows up with a URL-style client_id, AuthKit will fetch, validate, and cache that metadata per the 2025-11-25 spec, no Dynamic Client Registration required.

