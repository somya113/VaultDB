const { v4: uuidv4 } = require('uuid');

const { writeAuditLog } = require('../config/immudb');


const users = [
  { email: 'john@example.com', role: 'writer' },
  { email: 'sarah@example.com', role: 'reader' },
  { email: 'bob@example.com', role: 'writer' },
  { email: 'admin@finance.com', role: 'admin' },
];


const tables = ['customers', 'transactions', 'accounts', 'loans'];


const actions = ['SELECT', 'INSERT', 'UPDATE'];


const sensitiveFields = ['ssn', 'credit_card_last4'];


function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}


function createEntry(index) {
  const user = pick(users);
  const table = pick(tables);
  const action = pick(actions);
  const isSensitive = Math.random() < 0.2;
  const field = isSensitive ? pick(sensitiveFields) : null;
  const offsetMilliseconds = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
  const timestamp = new Date(Date.now() - offsetMilliseconds).toISOString();
  const query = field ? `${action} ${field} FROM ${table}` : `${action} ${table}`;
  return writeAuditLog({
    id: uuidv4(),
    timestamp,
    user_email: user.email,
    user_role: user.role,
    action,
    table_accessed: table,
    query_details: { query, benchmark_index: index + 1 },
    is_sensitive: isSensitive,
    result_summary: { success: true, status_code: 200 },
    ip_address: `192.0.2.${1 + Math.floor(Math.random() * 254)}`,
    response_time_ms: 5 + Math.floor(Math.random() * 196),
  });
}


function seed() {
  const totalEntries = 1050;
  let sensitiveCount = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    const entry = createEntry(index);
    if (entry.is_sensitive) sensitiveCount += 1;
    if ((index + 1) % 100 === 0 || index + 1 === totalEntries) {
      console.log(`Seeded ${index + 1}/${totalEntries} audit entries.`);
    }
  }
  console.log(`Seed complete: ${totalEntries} entries added; ${sensitiveCount} sensitive (${((sensitiveCount / totalEntries) * 100).toFixed(1)}%).`);
}


if (require.main === module) {
  seed();
}


module.exports = { seed };
