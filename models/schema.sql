-- Enable PostgreSQL's cryptographic helpers for bcrypt password hashes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remove dependent tables so this schema can be reapplied during development.
DROP TABLE IF EXISTS transactions, loans, accounts, customers, users CASCADE;

-- Store authenticated application users and their table-level permissions.
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'writer', 'reader')),
  assigned_tables TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store customer personally identifiable information separately from financial records.
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  ssn TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store customer account balances and account lifecycle state.
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store account-level money movements with only the last four card digits.
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  credit_card_last4 CHAR(4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store customer lending information and repayment status.
CREATE TABLE loans (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL,
  principal_amount DECIMAL(15, 2) NOT NULL CHECK (principal_amount >= 0),
  interest_rate DECIMAL(5, 2) NOT NULL CHECK (interest_rate >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the three required users with database-generated bcrypt hashes for password123.
INSERT INTO users (name, email, password_hash, role, assigned_tables) VALUES
  ('Finance Administrator', 'admin@finance.com', crypt('password123', gen_salt('bf', 10)), 'admin', ARRAY['customers', 'accounts', 'transactions', 'loans']),
  ('Finance Writer', 'writer@finance.com', crypt('password123', gen_salt('bf', 10)), 'writer', ARRAY['customers', 'transactions']),
  ('Finance Reader', 'reader@finance.com', crypt('password123', gen_salt('bf', 10)), 'reader', ARRAY['accounts']);

-- Seed three customers with representative, non-production sample data.
INSERT INTO customers (full_name, email, phone, ssn, address) VALUES
  ('Aisha Morgan', 'aisha.morgan@example.com', '555-0101', '111-22-3333', '101 Market Street'),
  ('Daniel Brooks', 'daniel.brooks@example.com', '555-0102', '222-33-4444', '202 Oak Avenue'),
  ('Priya Shah', 'priya.shah@example.com', '555-0103', '333-44-5555', '303 Pine Road');

-- Seed three accounts linked to the sample customers.
INSERT INTO accounts (customer_id, account_number, account_type, balance, status) VALUES
  (1, 'VAULT-0001', 'checking', 12500.00, 'active'),
  (2, 'VAULT-0002', 'savings', 28750.50, 'active'),
  (3, 'VAULT-0003', 'checking', 9400.25, 'active');

-- Seed three transactions linked to the sample accounts.
INSERT INTO transactions (account_id, type, amount, description, credit_card_last4) VALUES
  (1, 'credit', 2500.00, 'Payroll deposit', NULL),
  (2, 'debit', 175.50, 'Utility payment', '4242'),
  (3, 'credit', 900.25, 'Client payment', NULL);

-- Seed three loans linked to the sample customers.
INSERT INTO loans (customer_id, loan_type, principal_amount, interest_rate, status) VALUES
  (1, 'home', 250000.00, 4.25, 'active'),
  (2, 'auto', 32000.00, 5.10, 'active'),
  (3, 'education', 18000.00, 3.75, 'active');
