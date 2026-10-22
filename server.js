// Load environment variables before configuring the Express application.
require('dotenv').config();

// Import the HTTP framework and standard middleware.
const express = require('express');
const cors = require('cors');

// Import application middleware and route modules.
const auditLogger = require('./middleware/auditLogger');
const authRoutes = require('./routes/authRoutes');
const financeRoutes = require('./routes/financeRoutes');
const auditRoutes = require('./routes/auditRoutes');
const exportRoutes = require('./routes/exportRoutes');

// Create the application instance.
const app = express();

// Enable cross-origin requests for approved frontend clients.
app.use(cors());

// Parse JSON request bodies.
app.use(express.json());

// Serve static frontend assets when the public directory is present.
app.use(express.static('public'));

// Capture audit metadata for all JSON responses without blocking them.
app.use(auditLogger);

// Mount the authentication endpoints.
app.use('/api/auth', authRoutes);

// Mount finance, immutable audit-viewer, and compliance-report endpoints.
app.use('/api/finance', financeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/export', exportRoutes);

// Provide a simple operational health check.
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'VaultDB' }));

// Start listening only when this file is executed directly.
if (require.main === module) {
  const { getAuditStats } = require('./config/immudb');
  const { seed } = require('./scripts/seedData');
  if (getAuditStats().total_logs === 0) {
    console.log('Seeding initial benchmark audit ledger entries...');
    seed();
  }
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.log(`VaultDB server listening on port ${port}.`));
}

// Export the app for integration tests and embedding.
module.exports = app;
