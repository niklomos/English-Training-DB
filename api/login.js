// api/login.js
// ล็อกอิน: เช็ก username/password แล้วสร้าง session + cookie

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { randomUUID } = require('crypto');   // ✅ ใช้ของ Node แทน uuid package

const SESSION_COOKIE = 'vt_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 วัน

// ใช้ DATABASE_URL / POSTGRES_URL / POSTGRES_URL_NON_POOLING ตัวไหนก็ได้ที่มี
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
      ssl: { rejectUnauthorized: false }, // Neon ใช้ SSL
    });
  }
  return pool;
}

// helper: อ่าน JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// helper: ส่ง JSON
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  // GET เอาไว้ test ว่า function ยังรันได้
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      method: 'GET',
      message: 'login endpoint test (DB + sessions)',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const { username, password } = body || {};

    if (!username || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'ต้องมี username และ password',
      });
    }

    const pool = getPool();

    // ดึง user จาก DB
    const userResult = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (!userResult.rows.length) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username หรือ password ไม่ถูกต้อง',
      });
    }

    const user = userResult.rows[0];

    // เช็ครหัสผ่าน
    const ok = await bcrypt.compare(
      String(password),
      user.password_hash || ''
    );
    if (!ok) {
      return sendJson(res, 400, {
        ok: false,
        error: 'username หรือ password ไม่ถูกต้อง',
      });
    }

    // สร้าง session ใหม่
    const sessionId = randomUUID();  // ✅ ใช้ randomUUID แทน uuid.v4()
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await pool.query(
      `INSERT INTO sessions (id, user_id, created_at, expires_at)
       VALUES ($1, $2, NOW(), $3)`,
      [sessionId, user.id, expiresAt]
    );

    // set cookie
    const cookieHeader = cookie.serialize(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,      // บน Vercel เป็น https อยู่แล้ว
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    res.setHeader('Set-Cookie', cookieHeader);

    return sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
