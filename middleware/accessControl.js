const checkAccess = (tableName, allowedRoles = ['admin', 'writer', 'reader']) => (req, res, next) => {
  const method = req.method.toUpperCase();
  if (tableName === 'audit' && ['DELETE', 'PUT', 'POST'].includes(method)) {
    return res.status(403).json({ error: 'Audit logs are immutable. Nobody, not even admin, can modify audit records' });
  }
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient role permissions.' });
  }
  if (req.user.role === 'admin') return next();
  if (!Array.isArray(req.user.assigned_tables) || !req.user.assigned_tables.includes(tableName)) {
    return res.status(403).json({ error: 'You are not assigned to this table.' });
  }
  if (req.user.role === 'reader' && method !== 'GET') {
    return res.status(403).json({ error: 'Readers may only perform GET requests.' });
  }
  if (req.user.role === 'writer' && !['GET', 'POST'].includes(method)) {
    return res.status(403).json({ error: 'Writers may only perform GET and POST requests.' });
  }
  return next();
};


module.exports = checkAccess;
