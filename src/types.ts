// src/types.ts - TypeScript Type Definitions

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
 * Authentication result from validateAccessToken
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}
