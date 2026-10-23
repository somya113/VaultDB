require('dotenv').config();


const { Pool } = require('pg');



const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT || 5432),
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl: process.env.PG_HOST && process.env.PG_HOST.includes('supabase')
        ? { rejectUnauthorized: false }
        : false,
    };

const pool = new Pool(connectionConfig);


pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});


pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL connection verified.');
}).catch((error) => {
  console.error('PostgreSQL connection check failed:', error.message);
});


module.exports = pool;
