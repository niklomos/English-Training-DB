// api/ping.js
const { getPool, sendJson } = require('./db');

module.exports = async function handler(req, res) {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1 AS ok');

    sendJson(res, 200, {
      ok: true,
      method: req.method,
      db: result.rows[0],
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error('PING ERROR:', err);
    sendJson(res, 500, { ok: false, error: err.message });
  }
};
