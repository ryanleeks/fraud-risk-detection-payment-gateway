-- Create users table
-- This table stores user account information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,                          -- Auto-incrementing user ID
    full_name VARCHAR(255) NOT NULL,                -- User's full name
    email VARCHAR(255) UNIQUE NOT NULL,             -- Email (must be unique)
    password_hash VARCHAR(255) NOT NULL,            -- Encrypted password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When account was created
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Last update time
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add a comment to the table
COMMENT ON TABLE users IS 'Stores user account information for authentication';
