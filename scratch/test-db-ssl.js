const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;

console.log('Testing connection to:', url ? url.split('@')[1] : 'NONE');

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection failed:', err.message);
  } else {
    console.log('Connection successful:', res.rows[0]);
  }
  pool.end();
});
