// api/register.js
const bcrypt = require('bcryptjs');
const { getPool, sendJson } = require('./db');

// helper อ่าน body JSON
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const json = JSON.parse(data);
        resolve(json);
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await readBody(req);
    const { username, password } = body || {};

    if (!username || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username และ password ห้ามว่าง',
      });
    }

    const trimmedUser = String(username).trim();
    if (trimmedUser.length < 3) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username ต้องยาวอย่างน้อย 3 ตัวอักษร',
      });
    }
    if (String(password).length < 4) {
      return sendJson(res, 400, {
        ok: false,
        error: 'password ต้องยาวอย่างน้อย 4 ตัวอักษร',
      });
    }

    const pool = getPool();

    // 1) เช็ก username ซ้ำ
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [trimmedUser]
    );
    if (existing.rowCount > 0) {
      return sendJson(res, 409, {
        ok: false,
        error: 'username นี้ถูกใช้แล้ว',
      });
    }

    // 2) hash password
    const passwordHash = await bcrypt.hash(String(password), 10);

    // 3) insert user
    const inserted = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [trimmedUser, passwordHash]
    );

    const user = inserted.rows[0];

    return sendJson(res, 201, {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Server error: ' + err.message,
    });
  }
};
