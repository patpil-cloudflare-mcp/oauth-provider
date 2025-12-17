// src/types.ts - TypeScript Type Definitions for Phase 3 Authentication

/**
 * User object representing a registered user in the system
 */
export interface User {
  user_id: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  is_deleted?: number;
  deleted_at?: string | null;
  workos_user_id?: string;
}

/**
 * OAuth client configuration for pre-registered MCP servers
 */
export interface OAuthClient {
  client_id: string;
  client_secret_hash: string; // bcrypt hashed
  redirect_uris: string[];
  name: string;
  scopes: string[];
  created_at: string;
}

/**
 * Access token payload from Cloudflare Access JWT
 * Reference: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/application-token/
 */
export interface AccessTokenPayload {
  aud: string[]; // Application Audience tags
  email: string; // User email from identity provider
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  nbf: number; // Not before timestamp
  iss: string; // Issuer (team domain)
  sub: string; // Subject (user identifier)
  type: string; // Token type (e.g., "app")
  identity_nonce: string;
  country?: string;
  device_id?: string;
}

/**
 * OAuth authorization code stored in KV
 * OAuth 2.1: PKCE is MANDATORY for all authorization code flows
 */
export interface OAuthAuthorizationCode {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string;        // REQUIRED (OAuth 2.1 compliance)
  code_challenge_method: string; // REQUIRED (always 'S256')
  expires_at: number;
  created_at: number;
}

/**
 * OAuth access token stored in KV
 */
export interface OAuthAccessToken {
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number; // seconds
  user_id: string;
  client_id: string;
  scopes: string[];
  created_at: number;
  expires_at: number;
}

/**
 * User session stored in KV for caching validated JWTs
 */
export interface UserSession {
  user_id: string;
  email: string;
  jwt_hash: string; // Hash of the JWT for lookup
  created_at: number;
  expires_at: number;
}

/**
 * Authentication result from validateAccessToken
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * OAuth authorization request parameters
 * OAuth 2.1: PKCE is MANDATORY
 */
export interface OAuthAuthorizationRequest {
  client_id: string;
  redirect_uri: string;
  response_type: 'code';
  scope: string;
  state: string;
  code_challenge: string;      // REQUIRED (OAuth 2.1 compliance)
  code_challenge_method: 'S256'; // REQUIRED (only S256 allowed, plain deprecated)
}

/**
 * OAuth token request parameters
 * OAuth 2.1: code_verifier is MANDATORY for authorization_code grant
 */
export interface OAuthTokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string;              // Required when grant_type is 'authorization_code'
  refresh_token?: string;     // Required when grant_type is 'refresh_token'
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  code_verifier?: string;     // REQUIRED when grant_type is 'authorization_code' (OAuth 2.1)
}
