// Import UUID generation for unique mock audit-record identifiers.
const { v4: uuidv4 } = require('uuid'); // Reuse the project's existing UUID dependency.
// Import the immutable ledger writer used by the application middleware.
const { writeAuditLog } = require('../config/immudb'); // Seed through the same append-only interface as normal audit activity.

// Define representative non-production users for the benchmark dataset.
const users = [ // Distribute events across the requested four identities.
  { email: 'john@example.com', role: 'writer' }, // Represent a finance writer.
  { email: 'sarah@example.com', role: 'reader' }, // Represent a finance reader.
  { email: 'bob@example.com', role: 'writer' }, // Represent a second finance writer.
  { email: 'admin@finance.com', role: 'admin' }, // Match the seeded administrator account.
];

// Keep generated events within the finance routes' known table names.
const tables = ['customers', 'transactions', 'accounts', 'loans']; // Use schema-backed tables only.

// Select realistic database actions represented in the requested benchmark data.
const actions = ['SELECT', 'INSERT', 'UPDATE']; // Generate only the specified SQL action categories.

// Identify the fields used to represent sensitive query accesses.
const sensitiveFields = ['ssn', 'credit_card_last4']; // Include the two requested PII/payment-data patterns.

// Return a uniformly selected item from a non-empty array.
function pick(items) { // Keep the generator's random selection logic reusable.
  return items[Math.floor(Math.random() * items.length)]; // Select a random valid array index.
}

// Generate one mock event and append it to the immutable in-memory ledger.
function createEntry(index) { // Keep each record structurally compatible with auditLogger entries.
  const user = pick(users); // Randomize which benchmark identity performed the event.
  const table = pick(tables); // Randomize finance-table access.
  const action = pick(actions); // Randomize the SQL operation.
  const isSensitive = Math.random() < 0.2; // Assign roughly one in five generated records as sensitive.
  const field = isSensitive ? pick(sensitiveFields) : null; // Include an explicit field name for sensitive queries.
  const offsetMilliseconds = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); // Spread event times over the previous 30 days.
  const timestamp = new Date(Date.now() - offsetMilliseconds).toISOString(); // Store a standard UTC ISO timestamp.
  const query = field ? `${action} ${field} FROM ${table}` : `${action} ${table}`; // Make sensitive intent visible without recording real customer data.
  return writeAuditLog({ // Append this entry through the immutable ledger API.
    id: uuidv4(), // Ensure each generated record has a unique identifier.
    timestamp, // Preserve the randomly assigned historical timestamp.
    user_email: user.email, // Attribute the event to the selected user.
    user_role: user.role, // Preserve the selected user's role in the audit record.
    action, // Record SELECT, INSERT, or UPDATE.
    table_accessed: table, // Record the selected finance table.
    query_details: { query, benchmark_index: index + 1 }, // Store a safe SQL description and reproducible row index.
    is_sensitive: isSensitive, // Flag approximately 20 percent of records as sensitive.
    result_summary: { success: true, status_code: 200 }, // Represent a successful benchmark query.
    ip_address: `192.0.2.${1 + Math.floor(Math.random() * 254)}`, // Use documentation-only IP space rather than real user addresses.
    response_time_ms: 5 + Math.floor(Math.random() * 196), // Produce realistic inclusive response times from 5 to 200 ms.
  });
}

// Insert 1,050 events and print progress at each hundred-entry milestone.
function seed() { // Expose a standalone command-line benchmark workflow.
  const totalEntries = 1050; // Use the exact requested benchmark dataset size.
  let sensitiveCount = 0; // Track sensitive records for the final summary.
  for (let index = 0; index < totalEntries; index += 1) { // Generate every event exactly once.
    const entry = createEntry(index); // Write the next event to the in-memory ledger.
    if (entry.is_sensitive) sensitiveCount += 1; // Count sensitive entries as they are appended.
    if ((index + 1) % 100 === 0 || index + 1 === totalEntries) { // Report every 100 records and the final partial batch.
      console.log(`Seeded ${index + 1}/${totalEntries} audit entries.`); // Keep long CLI runs visibly active.
    }
  }
  console.log(`Seed complete: ${totalEntries} entries added; ${sensitiveCount} sensitive (${((sensitiveCount / totalEntries) * 100).toFixed(1)}%).`); // Summarize the generated dataset.
}

// Run only when executed directly as "node scripts/seedData.js".
if (require.main === module) { // Avoid seeding data if another module imports this script.
  seed(); // Execute the one-shot benchmark data generation.
}

// Export the seed function so it can be called on server bootstrap if needed.
module.exports = { seed };
