const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { query } = require('../lib/db');
const { readJsonBody, createSession } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const body = await readJsonBody(req);
  const username = (body.username || '').trim();
  const password = (body.password || '').trim();

  if (!username || !password) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'กรอก username และ password' }));
  }

  const result = await query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username]
  );

  if (!result.rows.length) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'username หรือ password ไม่ถูกต้อง' }));
  }

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'username หรือ password ไม่ถูกต้อง' }));
  }

  const { token, expires } = await createSession(user.id);

  // set cookie
  res.setHeader(
    'Set-Cookie',
    cookie.serialize('session', token, {
      httpOnly: true,
      secure: true, // บน vercel เป็น https อยู่แล้ว
      sameSite: 'lax',
      path: '/',
      expires,
    })
  );

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ user: { id: user.id, username: user.username } }));
};
