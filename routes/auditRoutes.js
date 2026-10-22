// Import Express to expose read-only audit endpoints.
const express = require('express'); // Reuse the application's existing HTTP framework.
// Import the existing JWT verifier.
const verifyToken = require('../middleware/authMiddleware'); // Protect every audit operation with authentication.
// Import the immutable ledger's read-only operations.
const { readAuditLogs, getAuditStats } = require('../config/immudb'); // Do not import or expose ledger mutation functions here.

// Create the audit router mounted at /api/audit.
const router = express.Router(); // Keep the route paths concise and mount-relative.

// Translate query parameters into the filter object accepted by the ledger module.
function getFilters(query) { // Share the same recognized filters across list and user history routes.
  return { // Return only fields supported by readAuditLogs.
    user_email: query.user_email, // Filter by an exact user email when provided.
    table_accessed: query.table_accessed, // Filter to a specific finance table.
    date_from: query.date_from, // Restrict results to timestamps at or after this date.
    date_to: query.date_to, // Restrict results to timestamps at or before this date.
    is_sensitive: query.is_sensitive, // Accept the ledger helper's boolean or string interpretation.
    page: query.page, // Forward the requested one-based page.
    limit: query.limit, // Forward the requested page size for bounded results.
  };
}

// List matching audit records with optional filters and pagination.
router.get('/logs', verifyToken, (req, res) => { // This viewer has no write or delete routes.
  try { // Catch synchronous errors from ledger filter handling.
    return res.json(readAuditLogs(getFilters(req.query))); // Return logs plus the ledger's page, limit, and total metadata.
  } catch (error) { // Handle invalid internal filter behavior without exposing details.
    console.error('Reading audit logs failed:', error); // Preserve diagnostics for the service operator.
    return res.status(500).json({ error: 'Unable to read audit logs.' }); // Return an explicit failure response.
  }
});

// Return aggregate audit metrics.
router.get('/stats', verifyToken, (req, res) => { // Require a valid token even for summary statistics.
  try { // Keep unexpected ledger errors within Express's response lifecycle.
    return res.json(getAuditStats()); // Return the immutable ledger's aggregate metrics.
  } catch (error) { // Handle errors from metric calculation.
    console.error('Reading audit statistics failed:', error); // Log diagnostic context without returning it publicly.
    return res.status(500).json({ error: 'Unable to read audit statistics.' }); // Explicitly report failure.
  }
});

// Return one user's history, enforcing self-only access for non-administrators.
router.get('/user/:email', verifyToken, (req, res) => { // Restrict user-specific history based on the token's role.
  const requestedEmail = req.params.email; // Read the target email from the route path.
  if (req.user.role !== 'admin' && req.user.email.toLowerCase() !== requestedEmail.toLowerCase()) { // Readers and writers may only inspect themselves.
    return res.status(403).json({ error: 'You may only view your own audit history.' }); // Deny cross-user history access.
  }
  try { // Query the ledger with the requested user and supported optional filters.
    const result = readAuditLogs({ ...getFilters(req.query), user_email: requestedEmail }); // Prevent query parameters from overriding the path identity.
    return res.json(result); // Return records with pagination metadata.
  } catch (error) { // Catch errors from ledger filtering.
    console.error('Reading user audit history failed:', error); // Log the failure for operators.
    return res.status(500).json({ error: 'Unable to read user audit history.' }); // Return a safe, explicit error.
  }
});

// Export only GET routes to keep the audit viewer strictly read-only.
module.exports = router; // No POST, PUT, PATCH, or DELETE handlers are defined.
