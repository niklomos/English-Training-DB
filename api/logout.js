// api/logout.js
const { sendJson, destroySession } = require('../http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    await destroySession(req, res);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('logout error', err);
    return sendJson(res, 500, { ok: false, error: 'internal error' });
  }
};
