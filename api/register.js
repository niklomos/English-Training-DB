// api/register.js
const bcrypt = require('bcryptjs');
const { query } = require('./db');
const { sendJson, readJsonBody } = require('../lib/http');

module.exports = async (req, res) => {
  // เอาไว้เช็คง่าย ๆ ว่า function โหลดไหม
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      method: 'GET',
      message: 'register endpoint works with DB',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    if (!username || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username & password required',
      });
    }

    // เช็คว่าซ้ำมั้ย
    const existing = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      return sendJson(res, 409, {
        ok: false,
        error: 'username already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1,$2)
       RETURNING id, username, created_at`,
      [username, passwordHash]
    );

    const user = result.rows[0];

    return sendJson(res, 201, { ok: true, user });
  } catch (err) {
    console.error('register error', err);
    return sendJson(res, 500, { ok: false, error: 'Internal server error' });
  }
};
