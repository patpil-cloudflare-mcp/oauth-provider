-- Migration number: 0001 	 2025-10-12T20:27:09.635Z
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================
-- TABELA 1: USERS
-- ============================================

CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    current_token_balance INTEGER DEFAULT 0,
    monthly_token_limit INTEGER,
    total_tokens_purchased INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
);

-- ============================================
-- TABELA 2: TRANSACTIONS
-- ============================================

CREATE TABLE transactions (
    transaction_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('purchase', 'usage')),
    token_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    stripe_payment_id TEXT,
    mcp_server_name TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================
-- TABELA 3: MCP_ACTIONS
-- ============================================

CREATE TABLE mcp_actions (
    action_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mcp_server_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tokens_consumed INTEGER NOT NULL,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    execution_time_ms INTEGER,
    parameters TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================
-- INDEKSY DLA TABELI USERS
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- ============================================
-- INDEKSY DLA TABELI TRANSACTIONS
-- ============================================

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_stripe_payment ON transactions(stripe_payment_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);

-- ============================================
-- INDEKSY DLA TABELI MCP_ACTIONS
-- ============================================

CREATE INDEX idx_mcp_actions_user_id ON mcp_actions(user_id);
CREATE INDEX idx_mcp_actions_server_name ON mcp_actions(mcp_server_name);
CREATE INDEX idx_mcp_actions_created_at ON mcp_actions(created_at DESC);

-- ============================================
-- OPTYMALIZACJA
-- ============================================

PRAGMA optimize;
