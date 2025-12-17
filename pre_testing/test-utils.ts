// pre_testing/test-utils.ts - Test utilities and mocks

/**
 * Mock D1 Database for testing
 */
export class MockD1Database {
  private data: Map<string, Record<string, unknown>[]> = new Map();
  private lastInsertId = 0;

  constructor() {
    // Initialize empty tables
    this.data.set('users', []);
    this.data.set('api_keys', []);
    this.data.set('account_deletions', []);
  }

  // Seed data for testing
  seedUsers(users: Record<string, unknown>[]) {
    this.data.set('users', [...users]);
  }

  seedApiKeys(keys: Record<string, unknown>[]) {
    this.data.set('api_keys', [...keys]);
  }

  // Get raw table data for assertions
  getTable(tableName: string): Record<string, unknown>[] {
    return this.data.get(tableName) || [];
  }

  // Clear all data
  reset() {
    this.data.set('users', []);
    this.data.set('api_keys', []);
    this.data.set('account_deletions', []);
    this.lastInsertId = 0;
  }

  prepare(sql: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(sql, this.data, () => ++this.lastInsertId);
  }

  batch(statements: MockD1PreparedStatement[]): Promise<D1Result[]> {
    return Promise.all(statements.map(stmt => stmt.run()));
  }
}

class MockD1PreparedStatement {
  private sql: string;
  private data: Map<string, Record<string, unknown>[]>;
  private bindings: unknown[] = [];
  private getNextId: () => number;

  constructor(
    sql: string,
    data: Map<string, Record<string, unknown>[]>,
    getNextId: () => number
  ) {
    this.sql = sql;
    this.data = data;
    this.getNextId = getNextId;
  }

  bind(...values: unknown[]): MockD1PreparedStatement {
    this.bindings = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const results = await this.all<T>();
    return results.results[0] || null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const sqlLower = this.sql.toLowerCase().trim();

    // Parse SELECT queries
    if (sqlLower.startsWith('select')) {
      const tableName = this.extractTableName(sqlLower);
      const table = this.data.get(tableName) || [];

      // Handle WHERE clause
      const whereMatch = sqlLower.match(/where\s+(.+?)(?:order|limit|$)/i);
      let filtered = [...table];

      if (whereMatch) {
        filtered = this.applyWhereClause(filtered, whereMatch[1]);
      }

      // Handle ORDER BY
      const orderMatch = sqlLower.match(/order\s+by\s+(\w+)\s+(asc|desc)?/i);
      if (orderMatch) {
        const field = orderMatch[1];
        const direction = orderMatch[2]?.toLowerCase() === 'desc' ? -1 : 1;
        filtered.sort((a, b) => {
          const aVal = a[field] as string | number;
          const bVal = b[field] as string | number;
          if (aVal < bVal) return -1 * direction;
          if (aVal > bVal) return 1 * direction;
          return 0;
        });
      }

      return {
        results: filtered as T[],
        success: true,
        meta: { changes: 0, last_row_id: 0, duration: 0, rows_read: filtered.length, rows_written: 0 }
      };
    }

    return { results: [], success: true, meta: { changes: 0, last_row_id: 0, duration: 0, rows_read: 0, rows_written: 0 } };
  }

  async run(): Promise<D1Result> {
    const sqlLower = this.sql.toLowerCase().trim();

    if (sqlLower.startsWith('insert')) {
      return this.handleInsert();
    }

    if (sqlLower.startsWith('update')) {
      return this.handleUpdate();
    }

    if (sqlLower.startsWith('delete')) {
      return this.handleDelete();
    }

    return { success: true, meta: { changes: 0, last_row_id: 0, duration: 0, rows_read: 0, rows_written: 0 }, results: [] };
  }

  private handleInsert(): D1Result {
    const tableName = this.extractTableName(this.sql.toLowerCase());
    const table = this.data.get(tableName) || [];

    // Parse column names from INSERT INTO table (col1, col2, ...) VALUES
    const columnsMatch = this.sql.match(/\(([^)]+)\)\s+VALUES/i);
    if (!columnsMatch) {
      return { success: false, meta: { changes: 0, last_row_id: 0, duration: 0, rows_read: 0, rows_written: 0 }, results: [] };
    }

    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const newRecord: Record<string, unknown> = {};

    columns.forEach((col, index) => {
      newRecord[col] = this.bindings[index];
    });

    table.push(newRecord);
    this.data.set(tableName, table);

    return {
      success: true,
      meta: { changes: 1, last_row_id: this.getNextId(), duration: 0, rows_read: 0, rows_written: 1 },
      results: []
    };
  }

  private handleUpdate(): D1Result {
    const tableName = this.extractTableName(this.sql.toLowerCase());
    const table = this.data.get(tableName) || [];

    // Parse SET clause
    const setMatch = this.sql.match(/SET\s+(.+?)\s+WHERE/i);
    if (!setMatch) {
      return { success: false, meta: { changes: 0, last_row_id: 0, duration: 0, rows_read: 0, rows_written: 0 }, results: [] };
    }

    const setPairs = setMatch[1].split(',').map(p => p.trim().split('=')[0].trim());

    // Parse WHERE clause
    const whereMatch = this.sql.match(/WHERE\s+(.+)$/i);
    let changes = 0;

    if (whereMatch) {
      table.forEach((record, index) => {
        if (this.matchesWhere(record, whereMatch[1])) {
          setPairs.forEach((col, i) => {
            table[index][col] = this.bindings[i];
          });
          changes++;
        }
      });
    }

    this.data.set(tableName, table);
    return { success: true, meta: { changes, last_row_id: 0, duration: 0, rows_read: 0, rows_written: changes }, results: [] };
  }

  private handleDelete(): D1Result {
    const tableName = this.extractTableName(this.sql.toLowerCase());
    const table = this.data.get(tableName) || [];

    const whereMatch = this.sql.match(/WHERE\s+(.+)$/i);
    let changes = 0;

    if (whereMatch) {
      const newTable = table.filter(record => {
        const shouldDelete = this.matchesWhere(record, whereMatch[1]);
        if (shouldDelete) changes++;
        return !shouldDelete;
      });
      this.data.set(tableName, newTable);
    }

    return { success: true, meta: { changes, last_row_id: 0, duration: 0, rows_read: 0, rows_written: 0 }, results: [] };
  }

  private extractTableName(sql: string): string {
    // Handle different SQL patterns
    const patterns = [
      /from\s+(\w+)/i,
      /into\s+(\w+)/i,
      /update\s+(\w+)/i,
      /delete\s+from\s+(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = sql.match(pattern);
      if (match) return match[1];
    }
    return '';
  }

  private applyWhereClause(records: Record<string, unknown>[], whereClause: string): Record<string, unknown>[] {
    return records.filter(record => this.matchesWhere(record, whereClause));
  }

  private matchesWhere(record: Record<string, unknown>, whereClause: string): boolean {
    // Handle simple conditions: field = ?
    const conditions = whereClause.split(/\s+and\s+/i);
    let bindingIndex = 0;

    // Count bindings used before WHERE clause in UPDATE queries
    if (this.sql.toLowerCase().includes('set')) {
      const setMatch = this.sql.match(/SET\s+(.+?)\s+WHERE/i);
      if (setMatch) {
        bindingIndex = setMatch[1].split(',').length;
      }
    }

    return conditions.every(condition => {
      const match = condition.match(/(\w+)\s*=\s*\?/);
      if (match) {
        const field = match[1];
        const value = this.bindings[bindingIndex++];
        return record[field] === value;
      }
      return true;
    });
  }
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

/**
 * Mock KV Namespace for testing
 */
export class MockKVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiration && Date.now() > entry.expiration) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl
      ? Date.now() + (options.expirationTtl * 1000)
      : undefined;

    this.store.set(key, { value, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }> {
    const keys: { name: string }[] = [];
    for (const key of this.store.keys()) {
      if (!options?.prefix || key.startsWith(options.prefix)) {
        keys.push({ name: key });
      }
    }
    return { keys };
  }

  // Test helper methods
  reset(): void {
    this.store.clear();
  }

  getAll(): Map<string, { value: string; expiration?: number }> {
    return new Map(this.store);
  }
}

/**
 * Create mock environment for testing
 */
export interface MockEnv {
  DB: MockD1Database;
  USER_SESSIONS: MockKVNamespace;
  OAUTH_STORE: MockKVNamespace;
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;
  OAUTH_BASE_URL: string;
}

export function createMockEnv(): MockEnv {
  return {
    DB: new MockD1Database(),
    USER_SESSIONS: new MockKVNamespace(),
    OAUTH_STORE: new MockKVNamespace(),
    WORKOS_API_KEY: 'test_workos_api_key',
    WORKOS_CLIENT_ID: 'test_workos_client_id',
    OAUTH_BASE_URL: 'https://panel.wtyczki.ai',
  };
}

/**
 * Test data generators
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const userId = overrides.user_id || crypto.randomUUID();
  return {
    user_id: userId,
    email: overrides.email || `test-${userId.slice(0, 8)}@example.com`,
    created_at: overrides.created_at || new Date().toISOString(),
    last_login_at: overrides.last_login_at || new Date().toISOString(),
    is_deleted: overrides.is_deleted ?? 0,
    deleted_at: overrides.deleted_at || null,
    workos_user_id: overrides.workos_user_id || `workos_${userId.slice(0, 8)}`,
  };
}

export interface TestUser {
  user_id: string;
  email: string;
  created_at: string;
  last_login_at: string;
  is_deleted: number;
  deleted_at: string | null;
  workos_user_id: string;
}

export function createTestApiKey(userId: string, overrides: Partial<TestApiKey> = {}): TestApiKey {
  const keyId = overrides.api_key_id || crypto.randomUUID();
  return {
    api_key_id: keyId,
    user_id: userId,
    api_key_hash: overrides.api_key_hash || `hash_${keyId.slice(0, 16)}`,
    key_prefix: overrides.key_prefix || `wtyk_${keyId.slice(0, 12)}`,
    name: overrides.name || 'Test API Key',
    last_used_at: overrides.last_used_at ?? null,
    created_at: overrides.created_at || Date.now(),
    expires_at: overrides.expires_at ?? null,
    is_active: overrides.is_active ?? 1,
  };
}

export interface TestApiKey {
  api_key_id: string;
  user_id: string;
  api_key_hash: string;
  key_prefix: string;
  name: string;
  last_used_at: number | null;
  created_at: number;
  expires_at: number | null;
  is_active: number;
}

/**
 * Hash API key (same as production)
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create mock Request
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: FormData | string;
  } = {}
): Request {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: options.headers,
  };

  if (options.body) {
    init.body = options.body;
  }

  return new Request(url, init);
}

/**
 * Create FormData with fields
 */
export function createFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

/**
 * Session helper
 */
export async function createMockSession(
  kv: MockKVNamespace,
  userId: string,
  email: string
): Promise<string> {
  const sessionToken = crypto.randomUUID();
  const session = {
    user_id: userId,
    email,
    workos_user_id: `workos_${userId.slice(0, 8)}`,
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    created_at: Date.now(),
    expires_at: Date.now() + (72 * 60 * 60 * 1000),
  };

  await kv.put(`workos_session:${sessionToken}`, JSON.stringify(session), {
    expirationTtl: 259200
  });

  return sessionToken;
}
