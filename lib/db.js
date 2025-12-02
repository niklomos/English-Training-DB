// db.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon ต้องใช้ SSL
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

module.exports = {
  pool,
  query,
};
