// api/db.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Neon ต้องใช้ SSL
  },
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

module.exports = { query, pool };
