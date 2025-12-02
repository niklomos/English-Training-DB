// api/register.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { serialize } = require('cookie');
const { query } = require('./db');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const { username, password } = req.body || {};

    if (!username || !password) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ error: 'username & password required' })
      );
      return;
    }

    // 1) เช็กว่า username ซ้ำไหม
    const existing = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Username already taken' }));
      return;
    }

    // 2) hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3) insert users
    const userResult = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, passwordHash]
    );

    const userId = userResult.rows[0].id;

    // 4) สร้าง session + token
    const token = uuidv4();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ); // 30 วัน

    await query(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expiresAt.toISOString()]
    );

    // 5) set cookie
    const cookie = serialize('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true, // บน https
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 วัน
    });

    res.setHeader('Set-Cookie', cookie);
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, userId }));
  } catch (err) {
    console.error('Register handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
};
