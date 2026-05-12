const bcrypt = require('bcryptjs');
const db = require('./index');

function seedAdminPassword() {
  const admin = db.prepare('SELECT teacher_id, password_hash FROM teacher WHERE teacher_id = 4').get();
  if (admin && admin.password_hash === null) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('UPDATE teacher SET password_hash = ? WHERE teacher_id = 4').run(hash);
    console.log('Seeded admin password for Robert Chen (teacher_id=4)');
  }
}

module.exports = { seedAdminPassword };
