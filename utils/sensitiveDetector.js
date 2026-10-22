// Keep the detector's vocabulary centralized so routes and reports share one policy.
const SENSITIVE_KEYWORDS = ['ssn', 'password', 'password_hash', 'credit_card', 'credit_card_last4', 'salary', 'pin', 'secret']; // Match the requested sensitive-data indicators.

// Map known finance tables to their baseline compliance sensitivity.
const TABLE_SENSITIVITY = { customers: 'HIGH', transactions: 'HIGH', accounts: 'MEDIUM', loans: 'MEDIUM', users: 'HIGH' }; // Unknown tables default to LOW.

// Find the first configured keyword in either the SQL/query text or table name.
function isSensitiveQuery(queryString, tableName) { // Accept route-generated query descriptions as well as raw SQL.
  const searchableText = `${queryString || ''} ${tableName || ''}`.toLowerCase(); // Normalize once for case-insensitive matching.
  const matchedKeyword = [...SENSITIVE_KEYWORDS].sort((left, right) => right.length - left.length).find((keyword) => searchableText.includes(keyword.toLowerCase())) || null; // Prefer the most specific keyword when indicators overlap.
  return { isSensitive: matchedKeyword !== null, matchedKeyword }; // Return both the boolean decision and its reason.
}

// Resolve the effective sensitivity, elevating any sensitive access to HIGH.
function getSensitivityLevel(tableName, isSensitive) { // Separate data-content sensitivity from table defaults.
  if (isSensitive) return 'HIGH'; // Sensitive fields always receive the highest classification.
  return TABLE_SENSITIVITY[String(tableName || '').toLowerCase()] || 'LOW'; // Unknown and unflagged tables are LOW.
}

// Provide a compact, consistent alert message for sensitive accesses.
function getSensitiveAlert(tableName, matchedKeyword) { // Keep alert wording identical wherever the helper is used.
  const label = matchedKeyword || 'sensitive data'; // Avoid displaying an empty match description.
  return `SENSITIVE ACCESS ALERT: ${label} accessed in ${tableName || 'unknown table'}.`; // Return a human-readable compliance alert.
}

// Expose the shared constants and classifier functions to the feature routes.
module.exports = { SENSITIVE_KEYWORDS, TABLE_SENSITIVITY, isSensitiveQuery, getSensitivityLevel, getSensitiveAlert }; // Preserve the project’s CommonJS module style.
