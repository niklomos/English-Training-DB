// api/logout.js
const cookie = require('cookie');
const { query, sendJson } = require('./db');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return cookie.parse(header);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies(req);
    const sessionId = cookies.session;

    if (sessionId) {
      try {
        await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      } catch (e) {
        console.warn('logout: delete session error', e.message);
      }
    }

    // clear cookie
    const clearCookie = cookie.serialize('session', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    res.setHeader('Set-Cookie', clearCookie);

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('logout error', err);
    return sendJson(res, 500, { ok: false, error: 'Server error (logout)' });
  }
};
