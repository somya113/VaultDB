const auditLedger = [];


const matchesFilters = (entry, filters = {}) => {
  const entryDate = new Date(entry.timestamp);
  const fromDate = filters.date_from ? new Date(filters.date_from) : null;
  const toDate = filters.date_to ? new Date(filters.date_to) : null;
  const matchesUser = !filters.user_email || entry.user_email === filters.user_email;
  const matchesTable = !filters.table_accessed || entry.table_accessed === filters.table_accessed;
  const matchesSensitive = filters.is_sensitive === undefined
    || entry.is_sensitive === (filters.is_sensitive === true || filters.is_sensitive === 'true');
  const matchesFrom = !fromDate || entryDate >= fromDate;
  const matchesTo = !toDate || entryDate <= toDate;
  return matchesUser && matchesTable && matchesSensitive && matchesFrom && matchesTo;
};


const writeAuditLog = (entry) => {
  const immutableEntry = Object.freeze({
    ...entry,
    sequence_id: auditLedger.length + 1,
    immutable_seal: true,
  });
  auditLedger.push(immutableEntry);
  return immutableEntry;
};


const readAuditLogs = (filters = {}) => {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const filtered = auditLedger.filter((entry) => matchesFilters(entry, filters)).reverse();
  const start = (page - 1) * limit;
  return { logs: filtered.slice(start, start + limit), page, limit, total: filtered.length };
};


const getAuditStats = () => {
  const today = new Date().toISOString().slice(0, 10);
  const sensitiveCount = auditLedger.filter((entry) => entry.is_sensitive).length;
  const users = new Set(auditLedger.map((entry) => entry.user_email));
  const tableCounts = auditLedger.reduce((counts, entry) => {
    counts[entry.table_accessed] = (counts[entry.table_accessed] || 0) + 1;
    return counts;
  }, {});
  const topTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0];
  const logsToday = auditLedger.filter((entry) => entry.timestamp.slice(0, 10) === today).length;
  return {
    total_logs: auditLedger.length,
    sensitive_count: sensitiveCount,
    unique_users: users.size,
    top_accessed_table: topTable ? topTable[0] : null,
    logs_today: logsToday,
  };
};


const getAllLogs = (filters = {}) => auditLedger.filter((entry) => matchesFilters(entry, filters)).reverse();


module.exports = { writeAuditLog, readAuditLogs, getAuditStats, getAllLogs };
