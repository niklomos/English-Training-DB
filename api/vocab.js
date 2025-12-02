// api/vocab.js
const cookie = require('cookie');
const { query, sendJson, readJsonBody } = require('./db');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return cookie.parse(header);
}

async function getUserFromRequest(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.session;
  if (!sessionId) return null;

  const result = await query(
    `
      SELECT u.id, u.username
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
    `,
    [sessionId]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
}

module.exports = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return sendJson(res, 401, { ok: false, error: 'ยังไม่ได้ login' });
    }

    // GET: ดึง vocab ทั้งหมดของ user
    if (req.method === 'GET') {
      const result = await query(
        `
          SELECT id, word, translation, correct, wrong, last_seen
          FROM vocab
          WHERE user_id = $1
          ORDER BY id ASC
        `,
        [user.id]
      );
      return sendJson(res, 200, { ok: true, items: result.rows });
    }

    // POST: เพิ่มคำใหม่
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const { word, translation } = body || {};

      if (!word || !translation) {
        return sendJson(res, 400, {
          ok: false,
          error: 'word และ translation ต้องไม่ว่าง',
        });
      }

      const now = new Date();
      const result = await query(
        `
          INSERT INTO vocab (user_id, word, translation, correct, wrong, last_seen)
          VALUES ($1, $2, $3, 0, 0, $4)
          RETURNING id, word, translation, correct, wrong, last_seen
        `,
        [user.id, word, translation, now]
      );

      return sendJson(res, 201, { ok: true, item: result.rows[0] });
    }

    // PUT/PATCH: แก้ไข
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const { id, word, translation, correct, wrong } = body || {};

      if (!id) {
        return sendJson(res, 400, { ok: false, error: 'ต้องมี id' });
      }

      const result = await query(
        `
          UPDATE vocab
          SET
            word = COALESCE($2, word),
            translation = COALESCE($3, translation),
            correct = COALESCE($4, correct),
            wrong = COALESCE($5, wrong),
            last_seen = NOW()
          WHERE id = $1 AND user_id = $6
          RETURNING id, word, translation, correct, wrong, last_seen
        `,
        [id, word, translation, correct, wrong, user.id]
      );

      if (result.rows.length === 0) {
        return sendJson(res, 404, { ok: false, error: 'ไม่พบคำนี้' });
      }

      return sendJson(res, 200, { ok: true, item: result.rows[0] });
    }

    // DELETE: ลบคำ
    if (req.method === 'DELETE') {
      const body = await readJsonBody(req);
      const { id } = body || {};

      if (!id) {
        return sendJson(res, 400, { ok: false, error: 'ต้องมี id' });
      }

      await query('DELETE FROM vocab WHERE id = $1 AND user_id = $2', [
        id,
        user.id,
      ]);

      return sendJson(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('vocab api error', err);
    return sendJson(res, 500, { ok: false, error: 'Server error (vocab)' });
  }
};
