// api/login.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cookie = require('cookie');
const { query, sendJson, readJsonBody } = require('./db');

module.exports = async (req, res) => {
  // ไว้เช็คง่าย ๆ ว่า endpoint ยังทำงาน
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      message: 'login endpoint online',
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
      // ไม่บอกว่าไม่มี user หรือรหัสผิด เพื่อความปลอดภัย
      return sendJson(res, 401, {
        ok: false,
        error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const user = result.rows[0];

    // เช็ครหัสผ่าน
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return sendJson(res, 401, {
        ok: false,
        error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // สร้าง session
    const sessionId = uuidv4();

    // แทรกลงตาราง sessions (ใช้เฉพาะคอลัมน์ที่ชัวร์ว่าอยู่แน่ ๆ)
    await query(
      'INSERT INTO sessions (id, user_id) VALUES ($1, $2)',
      [sessionId, user.id]
    );

    // สร้าง cookie session_id
    const cookieStr = cookie.serialize('session_id', sessionId, {
      httpOnly: true,
      secure: true,      // บน vercel ใช้ https อยู่แล้ว
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 วัน
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
    console.error('login error:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Server error (login): ' + (err.message || String(err)),
    });
  }
};
