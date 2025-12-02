// api/vocab.js
const { query } = require('../db');
const {
  sendJson,
  readJsonBody,
  getSessionUser,
} = require('../http');

module.exports = async function handler(req, res) {
  // ต้องมี login ก่อนเสมอ
  const user = await getSessionUser(req);
  if (!user) {
    return sendJson(res, 401, { ok: false, error: 'not logged in' });
  }

  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT id, word, translation, correct, wrong, last_seen
           FROM vocab_entries
          WHERE user_id = $1
          ORDER BY id`,
        [user.id]
      );

      return sendJson(res, 200, {
        ok: true,
        items: result.rows,
      });
    } catch (err) {
      console.error('vocab GET error', err);
      return sendJson(res, 500, { ok: false, error: 'internal error' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }

    const { word, translation } = body || {};
    if (!word || !translation) {
      return sendJson(res, 400, {
        ok: false,
        error: 'word & translation required',
      });
    }

    try {
      // เช็คคำซ้ำ (case-insensitive) ต่อ user
      const existing = await query(
        'SELECT id FROM vocab_entries WHERE user_id = $1 AND LOWER(word) = LOWER($2)',
        [user.id, word]
      );

      if (existing.rows.length) {
        return sendJson(res, 409, {
          ok: false,
          error: 'word already exists for this user',
        });
      }

      const result = await query(
        `INSERT INTO vocab_entries (user_id, word, translation, correct, wrong, last_seen)
         VALUES ($1,$2,$3,0,0,now())
         RETURNING id, word, translation, correct, wrong, last_seen`,
        [user.id, word, translation]
      );

      return sendJson(res, 201, {
        ok: true,
        item: result.rows[0],
      });
    } catch (err) {
      console.error('vocab POST error', err);
      return sendJson(res, 500, { ok: false, error: 'internal error' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
};
