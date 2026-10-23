const express = require('express');

const pool = require('../config/postgres');

const verifyToken = require('../middleware/authMiddleware');

const checkAccess = require('../middleware/accessControl');

const { isSensitiveQuery } = require('../utils/sensitiveDetector');


const router = express.Router();


function createAuditMiddleware(tableName) {
  return (req, res, next) => {
    req.params.table = tableName;
    req.body = { ...(req.body && typeof req.body === 'object' ? req.body : {}), table: tableName };
    const queryDescription = `${req.method} ${req.originalUrl} ${Object.keys(req.body || {}).join(' ')}`;
    req.auditSensitivity = isSensitiveQuery(queryDescription, tableName);
    return next();
  };
}


function isValidId(value) {
  return /^[1-9]\d*$/.test(String(value));
}


function handleDatabaseError(res, error, operation) {
  console.error(`${operation} failed:`, error);
  return res.status(500).json({ error: `${operation} failed.` });
}


router.get('/customers', verifyToken, checkAccess('customers', ['admin', 'writer', 'reader']), createAuditMiddleware('customers'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, phone, address, created_at FROM customers ORDER BY id');
    return res.json({ customers: result.rows });
  } catch (error) {
    return handleDatabaseError(res, error, 'Listing customers');
  }
});


router.get('/customers/:id', verifyToken, checkAccess('customers', ['admin', 'writer', 'reader']), createAuditMiddleware('customers'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Customer id must be a positive integer.' });
  try {
    const result = await pool.query('SELECT id, full_name, email, phone, address, created_at FROM customers WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found.' });
    return res.json({ customer: result.rows[0] });
  } catch (error) {
    return handleDatabaseError(res, error, 'Reading customer');
  }
});


router.post('/customers', verifyToken, checkAccess('customers', ['admin', 'writer']), createAuditMiddleware('customers'), async (req, res) => {
  const { full_name, email, phone = null, ssn = null, address = null } = req.body || {};
  if (!full_name || !email) return res.status(400).json({ error: 'full_name and email are required.' });
  try {
    const result = await pool.query('INSERT INTO customers (full_name, email, phone, ssn, address) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, address, created_at', [full_name, email, phone, ssn, address]);
    return res.status(201).json({ customer: result.rows[0] });
  } catch (error) {
    return handleDatabaseError(res, error, 'Creating customer');
  }
});


router.put('/customers/:id', verifyToken, checkAccess('customers', ['admin']), createAuditMiddleware('customers'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Customer id must be a positive integer.' });
  const { full_name, email, phone = null, ssn = null, address = null } = req.body || {};
  if (!full_name || !email) return res.status(400).json({ error: 'full_name and email are required.' });
  try {
    const result = await pool.query('UPDATE customers SET full_name = $1, email = $2, phone = $3, ssn = $4, address = $5 WHERE id = $6 RETURNING id, full_name, email, phone, address, created_at', [full_name, email, phone, ssn, address, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found.' });
    return res.json({ customer: result.rows[0] });
  } catch (error) {
    return handleDatabaseError(res, error, 'Updating customer');
  }
});


router.get('/accounts', verifyToken, checkAccess('accounts', ['admin', 'writer', 'reader']), createAuditMiddleware('accounts'), async (req, res) => {
  try {
    const result = await pool.query('SELECT a.id, a.customer_id, c.full_name AS customer_name, a.account_number, a.account_type, a.balance, a.status, a.created_at FROM accounts a JOIN customers c ON c.id = a.customer_id ORDER BY a.id');
    return res.json({ accounts: result.rows });
  } catch (error) {
    return handleDatabaseError(res, error, 'Listing accounts');
  }
});


router.post('/accounts', verifyToken, checkAccess('accounts', ['admin', 'writer']), createAuditMiddleware('accounts'), async (req, res) => {
  const { customer_id, account_number, account_type, balance = 0, status = 'active' } = req.body || {};
  if (!customer_id || !account_number || !account_type) return res.status(400).json({ error: 'customer_id, account_number, and account_type are required.' });
  if (!isValidId(customer_id)) return res.status(400).json({ error: 'customer_id must be a positive integer.' });
  if (!Number.isFinite(Number(balance))) return res.status(400).json({ error: 'balance must be a valid number.' });
  try {
    const result = await pool.query('INSERT INTO accounts (customer_id, account_number, account_type, balance, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, customer_id, account_number, account_type, balance, status, created_at', [customer_id, account_number, account_type, balance, status]);
    return res.status(201).json({ account: result.rows[0] });
  } catch (error) {
    return handleDatabaseError(res, error, 'Creating account');
  }
});


router.get('/transactions', verifyToken, checkAccess('transactions', ['admin', 'writer', 'reader']), createAuditMiddleware('transactions'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, account_id, type, amount, description, credit_card_last4, created_at FROM transactions ORDER BY id');
    return res.json({ transactions: result.rows });
  } catch (error) {
    return handleDatabaseError(res, error, 'Listing transactions');
  }
});


router.post('/transactions', verifyToken, checkAccess('transactions', ['admin', 'writer']), createAuditMiddleware('transactions'), async (req, res) => {
  const { account_id, type, amount, description = null, credit_card_last4 = null } = req.body || {};
  if (!account_id || !type || amount === undefined) return res.status(400).json({ error: 'account_id, type, and amount are required.' });
  if (!isValidId(account_id)) return res.status(400).json({ error: 'account_id must be a positive integer.' });
  if (!['credit', 'debit'].includes(type)) return res.status(400).json({ error: 'type must be credit or debit.' });
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) return res.status(400).json({ error: 'amount must be a non-negative number.' });
  if (credit_card_last4 !== null && !/^\d{4}$/.test(String(credit_card_last4))) return res.status(400).json({ error: 'credit_card_last4 must contain exactly four digits.' });
  try {
    const result = await pool.query('INSERT INTO transactions (account_id, type, amount, description, credit_card_last4) VALUES ($1, $2, $3, $4, $5) RETURNING id, account_id, type, amount, description, credit_card_last4, created_at', [account_id, type, amount, description, credit_card_last4]);
    return res.status(201).json({ transaction: result.rows[0] });
  } catch (error) {
    return handleDatabaseError(res, error, 'Creating transaction');
  }
});


router.get('/loans', verifyToken, checkAccess('loans', ['admin', 'writer', 'reader']), createAuditMiddleware('loans'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, customer_id, loan_type, principal_amount, interest_rate, status, created_at FROM loans ORDER BY id');
    return res.json({ loans: result.rows });
  } catch (error) {
    return handleDatabaseError(res, error, 'Listing loans');
  }
});


router.post('/loans', verifyToken, checkAccess('loans', ['admin', 'writer']), createAuditMiddleware('loans'), async (req, res) => {
  const { customer_id, loan_type, principal_amount, interest_rate, status = 'active' } = req.body || {};
  if (!customer_id || !loan_type || principal_amount === undefined || interest_rate === undefined) return res.status(400).json({ error: 'customer_id, loan_type, principal_amount, and interest_rate are required.' });
  if (!isValidId(customer_id)) return res.status(400).json({ error: 'customer_id must be a positive integer.' });
  if (!Number.isFinite(Number(principal_amount)) || Number(principal_amount) < 0) return res.status(400).json({ error: 'principal_amount must be a non-negative number.' });
  if (!Number.isFinite(Number(interest_rate)) || Number(interest_rate) < 0) return res.status(400).json({ error: 'interest_rate must be a non-negative number.' });
  try {
    const result = await pool.query('INSERT INTO loans (customer_id, loan_type, principal_amount, interest_rate, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, customer_id, loan_type, principal_amount, interest_rate, status, created_at', [customer_id, loan_type, principal_amount, interest_rate, status]);
    return res.status(201).json({ loan: result.rows[0] });
  } catch (error) {
    return handleDatabaseError(res, error, 'Creating loan');
  }
});


module.exports = router;
