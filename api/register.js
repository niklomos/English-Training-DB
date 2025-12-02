// api/register.js
const bcrypt = require('bcryptjs');
const { query, sendJson, readJsonBody } = require('./db');

module.exports = async (req, res) => {
  // เอาไว้เช็คง่าย ๆ ว่า endpoint ยังทำงาน
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      message: 'register endpoint online',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed',
    });
  }

  try {
    // อ่าน JSON body จาก request
    const body = await readJsonBody(req);
    const { username, password } = body || {};

    if (!username || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username และ password ต้องไม่ว่าง',
      });
    }

    // เช็คว่ามี username ซ้ำหรือยัง
    const existing = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      return sendJson(res, 409, {
        ok: false,
        error: 'username นี้ถูกใช้แล้ว',
      });
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // insert user ใหม่
    const result = await query(
      `
      INSERT INTO users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at
    `,
      [username, passwordHash]
    );

    const user = result.rows[0];

    return sendJson(res, 201, {
      ok: true,
      user,
    });
  } catch (err) {
    console.error('register error:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Server error (register): ' + (err.message || String(err)),
    });
  }
};
