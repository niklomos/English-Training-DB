// http.js
const cookie = require('cookie');
const { v4: uuidv4 } = require('uuid');
const { query } = require('./db');


const SESSION_COOKIE = 'vt_session';
const SESSION_TTL_HOURS = 24 * 7; // 7 วัน

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// สร้าง session + set cookie
async function createSession(userId, res) {
  const token = uuidv4();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000
  );

  await query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)',
    [token, userId, expiresAt.toISOString()]
  );

  const serialized = cookie.serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,    // บน https
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  });

  res.setHeader('Set-Cookie', serialized);
}

// อ่าน user จาก session cookie
async function getSessionUser(req) {
  const header = req.headers.cookie;
  if (!header) return null;

  const cookies = cookie.parse(header || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const result = await query(
    `SELECT u.id, u.username
       FROM sessions s
       JOIN users u ON s.user_id = u.id
      WHERE s.token = $1
        AND (s.expires_at IS NULL OR s.expires_at > now())`,
    [token]
  );

  if (!result.rows.length) return null;

  return {
    id: result.rows[0].id,
    username: result.rows[0].username,
    token,
  };
}

// ลบ session + เคลียร์ cookie
async function destroySession(req, res) {
  const header = req.headers.cookie;
  if (header) {
    const cookies = cookie.parse(header || '');
    const token = cookies[SESSION_COOKIE];
    if (token) {
      // เผื่อ error กดๆไป ไม่ต้องพังทั้ง request
      await query('DELETE FROM sessions WHERE token = $1', [token]).catch(
        () => {}
      );
    }
  }

  const serialized = cookie.serialize(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  res.setHeader('Set-Cookie', serialized);
}

module.exports = {
  sendJson,
  readJsonBody,
  createSession,
  getSessionUser,
  destroySession,
};
