// api/db.js
const { Pool } = require('pg');

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'Missing POSTGRES_URL / DATABASE_URL environment variable'
  );
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // สำหรับ Neon/Cloud
  },
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

module.exports = { query };
