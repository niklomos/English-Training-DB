// api/logout.js
const cookie = require('cookie');
const { query, sendJson } = require('./db');

function getSessionIdFromRequest(req) {
  const header = req.headers.cookie || req.headers.Cookie;
  if (!header) return null;
  const cookies = cookie.parse(header);
  return cookies.session_id || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed',
    });
  }

  try {
    const sessionId = getSessionIdFromRequest(req);

    if (sessionId) {
      await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    }

    // เคลียร์ cookie ทิ้ง
    const cookieStr = cookie.serialize('session_id', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    res.setHeader('Set-Cookie', cookieStr);

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('logout error:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Server error (logout): ' + (err.message || String(err)),
    });
  }
};
