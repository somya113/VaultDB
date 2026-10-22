// Import Express to define the finance API endpoints.
const express = require('express'); // Use the same framework as the existing application.
// Import the shared PostgreSQL connection pool.
const pool = require('../config/postgres'); // Reuse the configured pool instead of creating another connection.
// Import the existing JWT middleware under the requested verifyToken name.
const verifyToken = require('../middleware/authMiddleware'); // The existing module exports the token-verification function.
// Import table-level role authorization.
const checkAccess = require('../middleware/accessControl'); // Enforce the repository's assigned-table policy.
// Import the sensitivity classifier for audit metadata.
const { isSensitiveQuery } = require('../utils/sensitiveDetector'); // Use the common detector for finance accesses.

// Create an isolated router mounted at /api/finance.
const router = express.Router(); // Keep finance paths relative to the server mount point.

// Tag requests with the actual database table so the existing global audit logger records accurate table names.
function createAuditMiddleware(tableName) { // Match the requested per-route auditing middleware interface.
  return (req, res, next) => { // Use standard Express middleware semantics.
    req.params.table = tableName; // The existing audit logger reads req.params.table after the response is sent.
    req.body = { ...(req.body && typeof req.body === 'object' ? req.body : {}), table: tableName }; // Preserve the table tag for the logger after Express restores route parameters.
    const queryDescription = `${req.method} ${req.originalUrl} ${Object.keys(req.body || {}).join(' ')}`; // Include submitted field names without exposing field values.
    req.auditSensitivity = isSensitiveQuery(queryDescription, tableName); // Make sensitivity classification available to downstream handlers and inspection.
    return next(); // Preserve the existing app-level audit logger without creating duplicate ledger entries.
  };
}

// Validate route identifiers before using them as PostgreSQL parameters.
function isValidId(value) { // Prevent malformed identifiers from reaching the database.
  return /^[1-9]\d*$/.test(String(value)); // Accept only positive integer IDs.
}

// Return database failures as explicit server errors and keep details in server logs.
function handleDatabaseError(res, error, operation) { // Centralize consistent finance-route error handling.
  console.error(`${operation} failed:`, error); // Retain diagnostic details for operators.
  return res.status(500).json({ error: `${operation} failed.` }); // Avoid exposing database internals to API clients.
}

// List customers without returning their raw SSNs.
router.get('/customers', verifyToken, checkAccess('customers', ['admin', 'writer', 'reader']), createAuditMiddleware('customers'), async (req, res) => { // Require authentication, table access, and audit context.
  try { // Catch expected database failures for this request.
    const result = await pool.query('SELECT id, full_name, email, phone, address, created_at FROM customers ORDER BY id'); // Explicitly omit the ssn column.
    return res.json({ customers: result.rows }); // Return only the fields safe for ordinary customer listings.
  } catch (error) { // Keep query failures from becoming unhandled promise rejections.
    return handleDatabaseError(res, error, 'Listing customers'); // Report an actionable but non-sensitive error.
  }
});

// Read a single customer without exposing their raw SSN.
router.get('/customers/:id', verifyToken, checkAccess('customers', ['admin', 'writer', 'reader']), createAuditMiddleware('customers'), async (req, res) => { // Apply the same customer table policy to detail reads.
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Customer id must be a positive integer.' }); // Reject invalid identifiers before querying.
  try { // Catch database errors while fetching the requested customer.
    const result = await pool.query('SELECT id, full_name, email, phone, address, created_at FROM customers WHERE id = $1', [req.params.id]); // Keep the raw SSN excluded from detail responses too.
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found.' }); // Distinguish a missing record from a query failure.
    return res.json({ customer: result.rows[0] }); // Return the matching non-sensitive customer profile.
  } catch (error) { // Handle connection and SQL errors explicitly.
    return handleDatabaseError(res, error, 'Reading customer'); // Send a stable error response to the caller.
  }
});

// Create a customer using only fields supported by the existing schema.
router.post('/customers', verifyToken, checkAccess('customers', ['admin', 'writer']), createAuditMiddleware('customers'), async (req, res) => { // Restrict customer creation to admins and writers.
  const { full_name, email, phone = null, ssn = null, address = null } = req.body || {}; // Read allowed fields and give optional fields safe defaults.
  if (!full_name || !email) return res.status(400).json({ error: 'full_name and email are required.' }); // Enforce the schema's required customer fields.
  try { // Insert using bound parameters to avoid SQL injection.
    const result = await pool.query('INSERT INTO customers (full_name, email, phone, ssn, address) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, address, created_at', [full_name, email, phone, ssn, address]); // Store SSN when supplied but never return it.
    return res.status(201).json({ customer: result.rows[0] }); // Confirm creation with a redacted customer record.
  } catch (error) { // Catch schema, constraint, and connectivity failures.
    return handleDatabaseError(res, error, 'Creating customer'); // Log details and return a generic server error.
  }
});

// Update a customer's editable fields; only administrators may make changes.
router.put('/customers/:id', verifyToken, checkAccess('customers', ['admin']), createAuditMiddleware('customers'), async (req, res) => { // Enforce the requested admin-only update rule.
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Customer id must be a positive integer.' }); // Validate the customer identifier.
  const { full_name, email, phone = null, ssn = null, address = null } = req.body || {}; // Restrict updates to known schema fields.
  if (!full_name || !email) return res.status(400).json({ error: 'full_name and email are required.' }); // Require the customer's identifying fields.
  try { // Perform a parameterized update and return a redacted row.
    const result = await pool.query('UPDATE customers SET full_name = $1, email = $2, phone = $3, ssn = $4, address = $5 WHERE id = $6 RETURNING id, full_name, email, phone, address, created_at', [full_name, email, phone, ssn, address, req.params.id]); // Update SSN only when explicitly submitted and omit it from the result.
    if (result.rowCount === 0) return res.status(404).json({ error: 'Customer not found.' }); // Report a missing row without treating it as a server failure.
    return res.json({ customer: result.rows[0] }); // Return the updated record without its raw SSN.
  } catch (error) { // Handle PostgreSQL and constraint errors.
    return handleDatabaseError(res, error, 'Updating customer'); // Keep the response safe while logging diagnostic context.
  }
});

// List accounts together with the corresponding customer name.
router.get('/accounts', verifyToken, checkAccess('accounts', ['admin', 'writer', 'reader']), createAuditMiddleware('accounts'), async (req, res) => { // Protect account reads with account-table assignments.
  try { // Query account details and customer names in one operation.
    const result = await pool.query('SELECT a.id, a.customer_id, c.full_name AS customer_name, a.account_number, a.account_type, a.balance, a.status, a.created_at FROM accounts a JOIN customers c ON c.id = a.customer_id ORDER BY a.id'); // Join on the schema's customer foreign key.
    return res.json({ accounts: result.rows }); // Return the accounts and associated customer labels.
  } catch (error) { // Handle database errors from the join.
    return handleDatabaseError(res, error, 'Listing accounts'); // Return a stable error while retaining server-side diagnostics.
  }
});

// Create an account for an existing customer.
router.post('/accounts', verifyToken, checkAccess('accounts', ['admin', 'writer']), createAuditMiddleware('accounts'), async (req, res) => { // Allow only account writers and administrators.
  const { customer_id, account_number, account_type, balance = 0, status = 'active' } = req.body || {}; // Extract only supported account columns.
  if (!customer_id || !account_number || !account_type) return res.status(400).json({ error: 'customer_id, account_number, and account_type are required.' }); // Require schema-critical fields.
  if (!isValidId(customer_id)) return res.status(400).json({ error: 'customer_id must be a positive integer.' }); // Avoid invalid foreign-key identifiers.
  if (!Number.isFinite(Number(balance))) return res.status(400).json({ error: 'balance must be a valid number.' }); // Reject non-numeric account balances.
  try { // Insert the account with bound values.
    const result = await pool.query('INSERT INTO accounts (customer_id, account_number, account_type, balance, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, customer_id, account_number, account_type, balance, status, created_at', [customer_id, account_number, account_type, balance, status]); // Let PostgreSQL enforce foreign keys and uniqueness.
    return res.status(201).json({ account: result.rows[0] }); // Return the newly created account.
  } catch (error) { // Catch foreign-key, uniqueness, and database errors.
    return handleDatabaseError(res, error, 'Creating account'); // Keep database internals out of the response.
  }
});

// List transactions including the last four card digits, which the audit logger marks sensitive.
router.get('/transactions', verifyToken, checkAccess('transactions', ['admin', 'writer', 'reader']), createAuditMiddleware('transactions'), async (req, res) => { // Apply authenticated transaction-table access controls.
  try { // Fetch transaction records in a stable order.
    const result = await pool.query('SELECT id, account_id, type, amount, description, credit_card_last4, created_at FROM transactions ORDER BY id'); // Include last four digits for the requested auto-flagged sensitive response.
    return res.json({ transactions: result.rows }); // The global audit middleware detects credit_card_last4 in this response.
  } catch (error) { // Catch database failures.
    return handleDatabaseError(res, error, 'Listing transactions'); // Return a safe error to the client.
  }
});

// Create a transaction for an account.
router.post('/transactions', verifyToken, checkAccess('transactions', ['admin', 'writer']), createAuditMiddleware('transactions'), async (req, res) => { // Allow transaction writes only for writers and admins.
  const { account_id, type, amount, description = null, credit_card_last4 = null } = req.body || {}; // Extract supported transaction attributes.
  if (!account_id || !type || amount === undefined) return res.status(400).json({ error: 'account_id, type, and amount are required.' }); // Enforce required transaction values.
  if (!isValidId(account_id)) return res.status(400).json({ error: 'account_id must be a positive integer.' }); // Validate the referenced account ID.
  if (!['credit', 'debit'].includes(type)) return res.status(400).json({ error: 'type must be credit or debit.' }); // Match the database's transaction type constraint.
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) return res.status(400).json({ error: 'amount must be a non-negative number.' }); // Match the non-negative amount constraint.
  if (credit_card_last4 !== null && !/^\d{4}$/.test(String(credit_card_last4))) return res.status(400).json({ error: 'credit_card_last4 must contain exactly four digits.' }); // Validate the optional masked-card fragment.
  try { // Insert the transaction using parameter placeholders.
    const result = await pool.query('INSERT INTO transactions (account_id, type, amount, description, credit_card_last4) VALUES ($1, $2, $3, $4, $5) RETURNING id, account_id, type, amount, description, credit_card_last4, created_at', [account_id, type, amount, description, credit_card_last4]); // Return the record with its masked card field for sensitive auditing.
    return res.status(201).json({ transaction: result.rows[0] }); // Confirm transaction creation.
  } catch (error) { // Catch invalid references and database failures.
    return handleDatabaseError(res, error, 'Creating transaction'); // Do not disclose database internals.
  }
});

// List loans for readers, writers, and administrators.
router.get('/loans', verifyToken, checkAccess('loans', ['admin', 'writer', 'reader']), createAuditMiddleware('loans'), async (req, res) => { // Enforce loan-table assignments before reading.
  try { // Fetch loan records using the existing schema.
    const result = await pool.query('SELECT id, customer_id, loan_type, principal_amount, interest_rate, status, created_at FROM loans ORDER BY id'); // Select only loan columns required by the API.
    return res.json({ loans: result.rows }); // Return all matching loans.
  } catch (error) { // Catch PostgreSQL failures.
    return handleDatabaseError(res, error, 'Listing loans'); // Return the stable error shape.
  }
});

// Create a loan linked to an existing customer.
router.post('/loans', verifyToken, checkAccess('loans', ['admin', 'writer']), createAuditMiddleware('loans'), async (req, res) => { // Permit writes only to admins and writers.
  const { customer_id, loan_type, principal_amount, interest_rate, status = 'active' } = req.body || {}; // Extract loan fields accepted by the schema.
  if (!customer_id || !loan_type || principal_amount === undefined || interest_rate === undefined) return res.status(400).json({ error: 'customer_id, loan_type, principal_amount, and interest_rate are required.' }); // Validate mandatory loan attributes.
  if (!isValidId(customer_id)) return res.status(400).json({ error: 'customer_id must be a positive integer.' }); // Validate the related customer identifier.
  if (!Number.isFinite(Number(principal_amount)) || Number(principal_amount) < 0) return res.status(400).json({ error: 'principal_amount must be a non-negative number.' }); // Match the schema's principal constraint.
  if (!Number.isFinite(Number(interest_rate)) || Number(interest_rate) < 0) return res.status(400).json({ error: 'interest_rate must be a non-negative number.' }); // Match the schema's interest-rate constraint.
  try { // Insert the loan with parameterized values.
    const result = await pool.query('INSERT INTO loans (customer_id, loan_type, principal_amount, interest_rate, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, customer_id, loan_type, principal_amount, interest_rate, status, created_at', [customer_id, loan_type, principal_amount, interest_rate, status]); // Keep user input out of SQL syntax.
    return res.status(201).json({ loan: result.rows[0] }); // Return the new loan record.
  } catch (error) { // Catch foreign-key and other database errors.
    return handleDatabaseError(res, error, 'Creating loan'); // Log useful details and safely report failure.
  }
});

// Export the router for mounting by the main application.
module.exports = router; // server.js mounts these endpoints at /api/finance.
