const SENSITIVE_KEYWORDS = ['ssn', 'password', 'password_hash', 'credit_card', 'credit_card_last4', 'salary', 'pin', 'secret'];


const TABLE_SENSITIVITY = { customers: 'HIGH', transactions: 'HIGH', accounts: 'MEDIUM', loans: 'MEDIUM', users: 'HIGH' };


function isSensitiveQuery(queryString, tableName) {
  const searchableText = `${queryString || ''} ${tableName || ''}`.toLowerCase();
  const matchedKeyword = [...SENSITIVE_KEYWORDS].sort((left, right) => right.length - left.length).find((keyword) => searchableText.includes(keyword.toLowerCase())) || null;
  return { isSensitive: matchedKeyword !== null, matchedKeyword };
}


function getSensitivityLevel(tableName, isSensitive) {
  if (isSensitive) return 'HIGH';
  return TABLE_SENSITIVITY[String(tableName || '').toLowerCase()] || 'LOW';
}


function getSensitiveAlert(tableName, matchedKeyword) {
  const label = matchedKeyword || 'sensitive data';
  return `SENSITIVE ACCESS ALERT: ${label} accessed in ${tableName || 'unknown table'}.`;
}


module.exports = { SENSITIVE_KEYWORDS, TABLE_SENSITIVITY, isSensitiveQuery, getSensitivityLevel, getSensitiveAlert };
