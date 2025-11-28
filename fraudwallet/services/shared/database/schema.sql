-- FraudWallet PostgreSQL Database Schema
-- Microservices Architecture

-- ================================
-- USERS TABLE (Auth & User Service)
-- ================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(12) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    phone_last_changed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    account_status VARCHAR(20) DEFAULT 'active',
    twofa_enabled BOOLEAN DEFAULT FALSE,
    twofa_method VARCHAR(20) DEFAULT 'email',
    wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_account_id ON users(account_id);
CREATE INDEX idx_users_status ON users(account_status);

-- ================================
-- VERIFICATION CODES TABLE (Auth Service)
-- ================================
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'login', 'disable_2fa', 'phone_change'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP
);

-- Indexes for verification codes
CREATE INDEX idx_verification_user_id ON verification_codes(user_id);
CREATE INDEX idx_verification_code ON verification_codes(code);
CREATE INDEX idx_verification_expires ON verification_codes(expires_at);

-- ================================
-- TRANSACTIONS TABLE (Wallet Service)
-- ================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'add_funds', 'send', 'receive', 'split_payment'
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    description TEXT,
    stripe_payment_intent_id VARCHAR(255),
    recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    split_payment_id INTEGER, -- Foreign key added later
    fraud_score DECIMAL(5, 2) DEFAULT 0.00,
    fraud_flags JSONB, -- Store fraud detection flags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for transactions
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_recipient_id ON transactions(recipient_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_fraud_score ON transactions(fraud_score);

-- ================================
-- SPLIT PAYMENTS TABLE (SplitPay Service)
-- ================================
CREATE TABLE IF NOT EXISTS split_payments (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    num_participants INTEGER NOT NULL,
    amount_per_person DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for split payments
CREATE INDEX idx_split_payments_creator ON split_payments(creator_id);
CREATE INDEX idx_split_payments_status ON split_payments(status);
CREATE INDEX idx_split_payments_created_at ON split_payments(created_at DESC);

-- ================================
-- SPLIT PARTICIPANTS TABLE (SplitPay Service)
-- ================================
CREATE TABLE IF NOT EXISTS split_participants (
    id SERIAL PRIMARY KEY,
    split_payment_id INTEGER NOT NULL REFERENCES split_payments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    paid BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    paid_at TIMESTAMP,
    UNIQUE(split_payment_id, user_id)
);

-- Indexes for split participants
CREATE INDEX idx_split_participants_split_id ON split_participants(split_payment_id);
CREATE INDEX idx_split_participants_user_id ON split_participants(user_id);
CREATE INDEX idx_split_participants_status ON split_participants(status);

-- Add foreign key for transactions -> split_payments
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_split_payment
FOREIGN KEY (split_payment_id) REFERENCES split_payments(id) ON DELETE SET NULL;

-- ================================
-- FRAUD LOGS TABLE (Fraud Detection Service)
-- ================================
CREATE TABLE IF NOT EXISTS fraud_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    risk_score DECIMAL(5, 2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    flags JSONB, -- Store detailed fraud flags
    rules_triggered TEXT[], -- Array of triggered rule names
    action_taken VARCHAR(50), -- 'allowed', 'blocked', 'review_required'
    details JSONB, -- Store additional detection details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fraud logs
CREATE INDEX idx_fraud_logs_user_id ON fraud_logs(user_id);
CREATE INDEX idx_fraud_logs_transaction_id ON fraud_logs(transaction_id);
CREATE INDEX idx_fraud_logs_risk_level ON fraud_logs(risk_level);
CREATE INDEX idx_fraud_logs_created_at ON fraud_logs(created_at DESC);
CREATE INDEX idx_fraud_logs_risk_score ON fraud_logs(risk_score DESC);

-- ================================
-- USER RISK PROFILES TABLE (Fraud Detection Service)
-- ================================
CREATE TABLE IF NOT EXISTS user_risk_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_risk_score DECIMAL(5, 2) DEFAULT 0.00,
    total_transactions INTEGER DEFAULT 0,
    flagged_transactions INTEGER DEFAULT 0,
    blocked_transactions INTEGER DEFAULT 0,
    total_amount_transacted DECIMAL(15, 2) DEFAULT 0.00,
    avg_transaction_amount DECIMAL(10, 2) DEFAULT 0.00,
    max_transaction_amount DECIMAL(10, 2) DEFAULT 0.00,
    unusual_activity_count INTEGER DEFAULT 0,
    last_risk_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user risk profiles
CREATE INDEX idx_risk_profiles_user_id ON user_risk_profiles(user_id);
CREATE INDEX idx_risk_profiles_risk_score ON user_risk_profiles(overall_risk_score DESC);
CREATE INDEX idx_risk_profiles_flagged ON user_risk_profiles(flagged_transactions DESC);

-- ================================
-- SESSIONS TABLE (Auth Service - Optional)
-- ================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ================================
-- AUDIT LOGS TABLE (All Services)
-- ================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit logs
CREATE INDEX idx_audit_logs_service ON audit_logs(service_name);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ================================
-- TRIGGERS FOR UPDATED_AT
-- ================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_payments_updated_at
    BEFORE UPDATE ON split_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_profiles_updated_at
    BEFORE UPDATE ON user_risk_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- VIEWS FOR COMMON QUERIES
-- ================================

-- View: Active users with risk scores
CREATE OR REPLACE VIEW active_users_with_risk AS
SELECT
    u.id,
    u.account_id,
    u.full_name,
    u.email,
    u.phone_number,
    u.wallet_balance,
    u.account_status,
    COALESCE(urp.overall_risk_score, 0) as risk_score,
    COALESCE(urp.total_transactions, 0) as total_transactions,
    COALESCE(urp.flagged_transactions, 0) as flagged_transactions
FROM users u
LEFT JOIN user_risk_profiles urp ON u.id = urp.user_id
WHERE u.account_status = 'active';

-- View: Recent high-risk transactions
CREATE OR REPLACE VIEW recent_high_risk_transactions AS
SELECT
    t.id,
    t.user_id,
    u.full_name,
    u.email,
    t.type,
    t.amount,
    t.fraud_score,
    t.status,
    t.created_at
FROM transactions t
JOIN users u ON t.user_id = u.id
WHERE t.fraud_score > 70.00
ORDER BY t.created_at DESC
LIMIT 100;

-- ================================
-- DATABASE COMMENTS
-- ================================
COMMENT ON TABLE users IS 'Core user accounts and authentication data';
COMMENT ON TABLE verification_codes IS '2FA and verification codes with expiry';
COMMENT ON TABLE transactions IS 'All wallet transactions with fraud tracking';
COMMENT ON TABLE split_payments IS 'Bill splitting payment requests';
COMMENT ON TABLE split_participants IS 'Participants in split payments';
COMMENT ON TABLE fraud_logs IS 'Detailed fraud detection logs and analysis';
COMMENT ON TABLE user_risk_profiles IS 'Aggregated user risk metrics';
COMMENT ON TABLE sessions IS 'Active user sessions for token management';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail';
