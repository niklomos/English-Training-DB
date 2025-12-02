const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL env var');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // ประหยัด connection บน Neon free
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
