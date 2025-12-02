// api/login.js

const { sendJson } = require('./db');

module.exports = (req, res) => {
  // ฟังก์ชันง่าย ๆ ไว้ทดสอบก่อน
  return sendJson(res, 200, {
    ok: true,
    method: req.method,
    message: 'login endpoint test',
  });
};
