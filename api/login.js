// api/login.js
const bcrypt = require('bcryptjs');
// เดิม: const { query } = require('../db');
const { query } = require('./db');

// เดิม: const { sendJson, readJsonBody, ... } = require('../http');
const { sendJson, readJsonBody, createSession, getSessionUser, destroySession } = require('../lib/http');
const {
  sendJson,
  readJsonBody,
  createSession,
} = require('../http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }

  const { username, password } = body || {};
  if (!username || !password) {
    return sendJson(res, 400, {
      ok: false,
      error: 'username & password required',
    });
  }

  try {
    const result = await query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (!result.rows.length) {
      return sendJson(res, 401, { ok: false, error: 'invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return sendJson(res, 401, { ok: false, error: 'invalid credentials' });
    }

    // login สำเร็จ → สร้าง session + cookie
    await createSession(user.id, res);

    return sendJson(res, 200, {
      ok: true,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error('login error', err);
    return sendJson(res, 500, { ok: false, error: 'internal error' });
  }
};
