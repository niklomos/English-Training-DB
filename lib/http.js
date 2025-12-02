// lib/http.js
const { parse } = require('cookie');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../api/db');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) {
        req.connection.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};
  return parse(cookieHeader);
}

async function createSession(res, userId) {
  const token = uuidv4();
  await query(
    'INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, NOW())',
    [token, userId]
  );

  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
  );
}

async function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token) return null;

  const result = await query(
    `SELECT users.id, users.username
     FROM sessions
     JOIN users ON sessions.user_id = users.id
     WHERE sessions.token = $1`,
    [token]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (token) {
    await query('DELETE FROM sessions WHERE token = $1', [token]);
  }

  res.setHeader(
    'Set-Cookie',
    'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  );
}

module.exports = {
  sendJson,
  readJsonBody,
  createSession,
  getSessionUser,
  destroySession,
};
