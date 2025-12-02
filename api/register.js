// api/register.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // เผื่อใช้ทีหลัง
const { getPool, sendJson } = require('./db');

// helper อ่าน body (เพราะเราไม่ได้ใช้ Express)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // กัน body ใหญ่เกิน (1MB)
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

    if (typeof username !== 'string' || typeof password !== 'string') {
      return sendJson(res, 400, {
        ok: false,
        error: 'รูปแบบข้อมูลไม่ถูกต้อง',
      });
    }

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username ต้องยาวอย่างน้อย 3 ตัวอักษร',
      });
    }
    if (password.length < 4) {
      return sendJson(res, 400, {
        ok: false,
        error: 'password ต้องยาวอย่างน้อย 4 ตัวอักษร',
      });
    }

    const pool = getPool();

    // เช็คว่าซ้ำหรือยัง
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

    // hash password
    const passwordHash = await bcrypt.hash(password, 10);

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
