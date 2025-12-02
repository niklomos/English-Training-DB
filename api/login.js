// api/login.js
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { v4: uuidv4 } = require('uuid');
const { query, sendJson, readJsonBody } = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { username, password } = body || {};

    if (!username || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username และ password ต้องไม่ว่าง',
      });
    }

    // หา user
    const result = await query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return sendJson(res, 401, { ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = result.rows[0];

    // เช็ครหัสผ่าน
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return sendJson(res, 401, { ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // สร้าง session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 วัน

    await query(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
      [sessionId, user.id, expiresAt]
    );

    // set cookie
    const cookieStr = cookie.serialize('session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    res.setHeader('Set-Cookie', cookieStr);

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('login error', err);
    return sendJson(res, 500, { ok: false, error: 'Server error (login)' });
  }
};
