const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('./index');

function initSchema() {
  // Read and execute adapt-database.sql from project root
  const sqlPath = path.join(config.rootDir, 'adapt-database.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  db.exec(sql);

  // Add password_hash column to teacher table (idempotent — SQLite throws if already exists)
  try {
    db.exec('ALTER TABLE teacher ADD COLUMN password_hash TEXT');
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      throw err;
    }
  }

  // Create refresh_token table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_token (
      token_id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teacher(teacher_id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for refresh token lookups
  db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_token(token_hash)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_token_teacher ON refresh_token(teacher_id)');
}

module.exports = { initSchema };
