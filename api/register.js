const bcrypt = require('bcryptjs');
const { query } = require('../lib/db');
const { readJsonBody } = require('../lib/http');

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
    return res.end(JSON.stringify({ error: 'username และ password ห้ามว่าง' }));
  }

  if (password.length < 6) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'password ต้องอย่างน้อย 6 ตัว' }));
  }

  // เช็ค user ซ้ำ
  const existing = await query('SELECT id FROM users WHERE username = $1', [
    username,
  ]);
  if (existing.rows.length) {
    res.statusCode = 409;
    return res.end(JSON.stringify({ error: 'Username นี้ถูกใช้แล้ว' }));
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `
    INSERT INTO users (username, password_hash)
    VALUES ($1, $2)
    RETURNING id, username
  `,
    [username, hash]
  );

  const user = result.rows[0];

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 201;
  res.end(JSON.stringify({ user }));
};
