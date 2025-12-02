// api/db.js
const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let pool;

function getPool() {
  if (!pool) {
    if (!connectionString) {
      throw new Error('DATABASE_URL / POSTGRES_URL is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // ใช้กับ Neon บน Vercel
    });
  }
  return pool;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = { getPool, sendJson };
