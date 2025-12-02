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
      throw new Error('DATABASE_URL / POSTGRES_URL not set');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // สำหรับ Neon บน Vercel
    });
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  const res = await client.query(text, params);
  return res;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        const json = data ? JSON.parse(data) : {};
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  query,
  sendJson,
  readJsonBody,
};
