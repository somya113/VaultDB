// Load environment variables before constructing the database pool.
require('dotenv').config();

// Import PostgreSQL's pooled connection implementation.
const { Pool } = require('pg');

// Create a pool from environment settings so every request can reuse connections.
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

// Report connectivity failures without preventing the application from starting.
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

// Verify connectivity when the module is first loaded.
pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL connection verified.');
}).catch((error) => {
  console.error('PostgreSQL connection check failed:', error.message);
});

// Export the shared pool for route and service modules.
module.exports = pool;
