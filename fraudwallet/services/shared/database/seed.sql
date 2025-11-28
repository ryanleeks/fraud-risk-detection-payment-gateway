-- Seed data for FraudWallet PostgreSQL database
-- Used for development and testing

-- ================================
-- SEED TEST USERS
-- ================================

-- Note: Password for all test users is 'Test1234!'
-- Hash: $2b$10$... (bcrypt hash)

-- Test User 1: Regular user
INSERT INTO users (account_id, full_name, email, password_hash, phone_number, wallet_balance, twofa_enabled, twofa_method)
VALUES
('100000000001', 'John Doe', 'john@test.com', '$2b$10$YourBcryptHashHere', '+60123456789', 1000.00, FALSE, 'email'),
('100000000002', 'Jane Smith', 'jane@test.com', '$2b$10$YourBcryptHashHere', '+60123456788', 500.00, TRUE, 'email'),
('100000000003', 'Bob Johnson', 'bob@test.com', '$2b$10$YourBcryptHashHere', '+60123456787', 250.00, FALSE, 'email'),
('100000000004', 'Alice Williams', 'alice@test.com', '$2b$10$YourBcryptHashHere', '+60123456786', 750.00, TRUE, 'sms')
ON CONFLICT (email) DO NOTHING;

-- ================================
-- SEED SAMPLE TRANSACTIONS
-- ================================

-- Sample transactions for John Doe (user_id: 1)
INSERT INTO transactions (user_id, type, amount, status, description, created_at)
VALUES
(1, 'add_funds', 500.00, 'completed', 'Added funds via Stripe', CURRENT_TIMESTAMP - INTERVAL '7 days'),
(1, 'send', 50.00, 'completed', 'Sent money to Jane', CURRENT_TIMESTAMP - INTERVAL '5 days'),
(1, 'receive', 100.00, 'completed', 'Received from Bob', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(1, 'add_funds', 500.00, 'completed', 'Added more funds', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- Sample transactions for Jane Smith (user_id: 2)
INSERT INTO transactions (user_id, type, amount, status, description, recipient_id, created_at)
VALUES
(2, 'add_funds', 300.00, 'completed', 'Initial deposit', 1, CURRENT_TIMESTAMP - INTERVAL '10 days'),
(2, 'receive', 50.00, 'completed', 'Received from John', 1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(2, 'send', 25.00, 'completed', 'Sent to Bob', 3, CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ================================
-- SEED SAMPLE SPLIT PAYMENTS
-- ================================

-- Sample split payment
INSERT INTO split_payments (creator_id, title, description, total_amount, num_participants, amount_per_person, status)
VALUES
(1, 'Team Lunch', 'Lunch at Italian restaurant', 200.00, 4, 50.00, 'active'),
(2, 'Office Supplies', 'Shared office equipment', 400.00, 2, 200.00, 'pending')
ON CONFLICT DO NOTHING;

-- Sample split participants
INSERT INTO split_participants (split_payment_id, user_id, status, paid)
VALUES
(1, 1, 'accepted', TRUE),
(1, 2, 'accepted', TRUE),
(1, 3, 'accepted', FALSE),
(1, 4, 'pending', FALSE),
(2, 2, 'accepted', FALSE),
(2, 3, 'accepted', FALSE)
ON CONFLICT DO NOTHING;

-- ================================
-- SEED USER RISK PROFILES
-- ================================

INSERT INTO user_risk_profiles (user_id, overall_risk_score, total_transactions, flagged_transactions, total_amount_transacted, avg_transaction_amount)
VALUES
(1, 15.5, 4, 0, 1150.00, 287.50),
(2, 12.0, 3, 0, 375.00, 125.00),
(3, 8.5, 1, 0, 250.00, 250.00),
(4, 5.0, 0, 0, 0.00, 0.00)
ON CONFLICT (user_id) DO NOTHING;

-- ================================
-- SEED SAMPLE FRAUD LOGS
-- ================================

INSERT INTO fraud_logs (user_id, transaction_id, risk_score, risk_level, flags, rules_triggered, action_taken, details)
VALUES
(1, 1, 15.5, 'low', '{"velocity_check": false, "amount_unusual": false}', ARRAY['basic_check'], 'allowed', '{"check_time_ms": 45}'),
(2, 5, 22.3, 'low', '{"velocity_check": false, "amount_unusual": true}', ARRAY['amount_check'], 'allowed', '{"check_time_ms": 52}')
ON CONFLICT DO NOTHING;

-- ================================
-- SEED SAMPLE AUDIT LOGS
-- ================================

INSERT INTO audit_logs (service_name, user_id, action, entity_type, entity_id, ip_address)
VALUES
('auth-service', 1, 'user_login', 'user', 1, '192.168.1.100'),
('auth-service', 2, 'user_login', 'user', 2, '192.168.1.101'),
('wallet-service', 1, 'transaction_created', 'transaction', 1, '192.168.1.100'),
('splitpay-service', 1, 'split_payment_created', 'split_payment', 1, '192.168.1.100')
ON CONFLICT DO NOTHING;

-- Show seeded data counts
SELECT
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM transactions) as transactions_count,
    (SELECT COUNT(*) FROM split_payments) as split_payments_count,
    (SELECT COUNT(*) FROM fraud_logs) as fraud_logs_count,
    (SELECT COUNT(*) FROM audit_logs) as audit_logs_count;
