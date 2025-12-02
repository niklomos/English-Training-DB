// api/login.js
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { getPool, sendJson } = require('./db');

// ตัวช่วยอ่าน JSON body จาก request
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        if (!data) return resolve({});
        const json = JSON.parse(data.toString('utf8'));
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  // ทดสอบง่าย ๆ ด้วย GET
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      method: 'GET',
      message: 'login endpoint test (DB + sessions)'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  // -------- อ่าน body --------
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    console.error('login: invalid json body', err);
    return sendJson(res, 400, { ok: false, error: 'invalid_json' });
  }

  const username = (body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return sendJson(res, 400, {
      ok: false,
      error: 'missing_username_or_password'
    });
  }

  try {
    const pool = await getPool();

    // ดึง user จาก DB
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    // 🔴 ตรงนี้คือจุดสำคัญ: เช็คก่อนว่าเจอ user มั้ย
    if (!rows || rows.length === 0) {
      return sendJson(res, 401, {
        ok: false,
        error: 'invalid_credentials'
      });
    }

    const user = rows[0];

    // เช็ค password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendJson(res, 401, {
        ok: false,
        error: 'invalid_credentials'
      });
    }

    // สร้าง session token
    const token = randomUUID();

    await pool.query(
      `INSERT INTO sessions (user_id, token, created_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + interval '30 days')`,
      [user.id, token]
    );

    // set cookie (ง่าย ๆ ใช้ header ตรง ๆ)
    const maxAgeSeconds = 60 * 60 * 24 * 30; // 30 วัน
    res.setHeader(
      'Set-Cookie',
      [
        `session=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Secure',             // ถ้า dev ผ่าน http ธรรมดาใน local ไม่ต้องมีบรรทัดนี้
        `Max-Age=${maxAgeSeconds}`
      ].join('; ')
    );

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (err) {
    console.error('login error', err);
    return sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
