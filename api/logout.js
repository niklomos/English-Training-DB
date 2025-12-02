const cookie = require('cookie');
const { getSessionTokenFromReq, deleteSession } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const token = getSessionTokenFromReq(req);
  if (token) {
    await deleteSession(token);
  }

  // เคลียร์ cookie ทิ้ง
  res.setHeader(
    'Set-Cookie',
    cookie.serialize('session', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    })
  );

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
};
