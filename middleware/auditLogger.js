// Import UUID generation and immutable ledger writing.
const { v4: uuidv4 } = require('uuid');
const { writeAuditLog } = require('../config/immudb');

// Identify sensitive fields without storing their values in audit records.
const containsSensitiveData = (value) => /ssn|credit_card|password|salary/i.test(JSON.stringify(value || {}));

// Record response metadata after the client has received the response.
const auditLogger = (req, res, next) => {
  const startedAt = Date.now();
  const originalJson = res.json.bind(res);
  let responseBody;
  res.json = (body) => {
    responseBody = body;
    const result = originalJson(body);
    setImmediate(() => {
      const actionByMethod = { GET: 'SELECT', POST: 'INSERT', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
      const tableName = req.params.table || req.body?.table || req.path.split('/').filter(Boolean).pop() || 'unknown';
      writeAuditLog({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        user_email: req.user?.email || 'anonymous',
        user_role: req.user?.role || 'anonymous',
        action: actionByMethod[req.method] || req.method,
        table_accessed: tableName,
        query_details: { method: req.method, path: req.originalUrl },
        is_sensitive: containsSensitiveData(req.body) || containsSensitiveData(responseBody),
        result_summary: { status_code: res.statusCode, success: res.statusCode < 400 },
        ip_address: req.ip,
        response_time_ms: Date.now() - startedAt,
      });
    });
    return result;
  };
  return next();
};

// Export the non-blocking response logger.
module.exports = auditLogger;
