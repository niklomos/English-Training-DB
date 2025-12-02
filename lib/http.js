const cookie = require('cookie');
const { query } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function readJsonBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
  }
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function getSessionTokenFromReq(req) {
  const header = req.headers.cookie || '';
  const cookies = cookie.parse(header || '');
  return cookies.session || null;
}

async function getUserFromRequest(req) {
  const token = getSessionTokenFromReq(req);
  if (!token) return null;

  const now = new Date();
  const res = await query(
    `
    SELECT u.id, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = $1 AND s.expires_at > $2
  `,
    [token, now]
  );

  if (!res.rows.length) return null;
  return res.rows[0];
}

async function createSession(userId, days = 7) {
  const token = uuidv4();
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await query(
    `
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES ($1, $2, $3)
  `,
    [userId, token, expires]
  );

  return { token, expires };
}

async function deleteSession(token) {
  if (!token) return;
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}

module.exports = {
  readJsonBody,
  getUserFromRequest,
  getSessionTokenFromReq,
  createSession,
  deleteSession,
};
