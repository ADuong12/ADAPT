const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('./index');

function initSchema() {
  // Check if schema already initialized (teacher table exists and has data)
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='teacher'"
  ).get();

  if (!tableExists) {
    // Fresh database — run full SQL file to create tables and seed data
    const sqlPath = path.join(config.rootDir, 'adapt-database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    db.exec(sql);
  }
  // If data exists, schema is already initialized — skip SQL file

  // Add password_hash column to teacher table (idempotent)
  try {
    db.exec('ALTER TABLE teacher ADD COLUMN password_hash TEXT');
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      throw err;
    }
  }

  // Create refresh_token table (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_token (
      token_id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teacher(teacher_id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for refresh token lookups (idempotent)
  db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_token(token_hash)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_token_teacher ON refresh_token(teacher_id)');
}

module.exports = { initSchema };
