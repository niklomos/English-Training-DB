const { query } = require('../lib/db');
const { readJsonBody, getUserFromRequest } = require('../lib/http');

module.exports = async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'ต้อง login ก่อน' }));
  }

  res.setHeader('Content-Type', 'application/json');

  // 1) GET: list vocab ของ user
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
    return res.end(JSON.stringify({ items: result.rows }));
  }

  // body สำหรับ POST/PUT/DELETE
  const body = await readJsonBody(req);

  // 2) POST: เพิ่มคำใหม่ (กันคำซ้ำใน user เดียวกัน)
  if (req.method === 'POST') {
    const word = (body.word || '').trim();
    const translation = (body.translation || '').trim();

    if (!word || !translation) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'ต้องมีทั้ง word และ translation' }));
    }

    // เช็คซ้ำเคสไม่สนตัวเล็กใหญ่
    const dup = await query(
      `
      SELECT id FROM vocab
      WHERE user_id = $1 AND lower(word) = lower($2)
    `,
      [user.id, word]
    );

    if (dup.rows.length) {
      res.statusCode = 409;
      return res.end(
        JSON.stringify({ error: 'คำนี้มีอยู่แล้วใน vocabulary ของคุณ' })
      );
    }

    const result = await query(
      `
      INSERT INTO vocab (user_id, word, translation, correct, wrong, last_seen)
      VALUES ($1, $2, $3, 0, 0, NOW())
      RETURNING id, word, translation, correct, wrong, last_seen
    `,
      [user.id, word, translation]
    );

    return res.end(JSON.stringify({ item: result.rows[0] }));
  }

  // 3) PUT: แก้ไข vocab เช่น word/translation หรือสถิติ correct/wrong
  if (req.method === 'PUT') {
    const id = body.id;
    const word = (body.word || '').trim();
    const translation = (body.translation || '').trim();
    const correct = body.correct ?? 0;
    const wrong = body.wrong ?? 0;

    // เช็คว่าเป็นของ user นี้จริงไหม
    const check = await query(
      'SELECT id FROM vocab WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (!check.rows.length) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'ไม่พบคำศัพท์นี้' }));
    }

    const result = await query(
      `
      UPDATE vocab
      SET word = $1,
          translation = $2,
          correct = $3,
          wrong = $4,
          last_seen = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING id, word, translation, correct, wrong, last_seen
    `,
      [word, translation, correct, wrong, id, user.id]
    );

    return res.end(JSON.stringify({ item: result.rows[0] }));
  }

  // 4) DELETE: ลบ vocab
  if (req.method === 'DELETE') {
    const id = body.id;
    await query('DELETE FROM vocab WHERE id = $1 AND user_id = $2', [
      id,
      user.id,
    ]);
    return res.end(JSON.stringify({ ok: true }));
  }

  // method อื่น ๆ
  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
