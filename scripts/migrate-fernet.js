#!/usr/bin/env node

/**
 * Fernet → AES-256-GCM migration script.
 * 
 * Prerequisites:
 * - Python 3 with `cryptography` library installed (pip install cryptography)
 * - ENCRYPTION_KEY set in server/.env (64-char hex string)
 * - Fernet key available (from .secret_key file or ADAPT_SECRET_KEY env var)
 * 
 * Usage: node scripts/migrate-fernet.js
 * 
 * Per D-12: Run manually once before starting the app. NOT auto-migration.
 * Per D-13: Uses Python child_process for Fernet decryption.
 */

const Database = require('better-sqlite3');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load env from server/.env
require('dotenv').config({ path: path.resolve(__dirname, '..', 'server', '.env') });

const { encrypt, decrypt } = require('../server/src/services/crypto');

const DB_PATH = path.resolve(__dirname, '..', 'adapt.db');
const FERNET_KEY_PATH = path.resolve(__dirname, '..', '.secret_key');

function decryptFernet(encryptedValue) {
  // Use Python to decrypt Fernet token
  const key = fs.readFileSync(FERNET_KEY_PATH, 'utf8').trim();
  const pythonScript = `
import sys
from cryptography.fernet import Fernet
key = sys.argv[1]
token = sys.argv[2]
f = Fernet(key.encode() if isinstance(key, str) else key)
print(f.decrypt(token.encode()).decode())
`;
  const tmpFile = path.resolve(__dirname, '_decrypt_tmp.py');
  fs.writeFileSync(tmpFile, pythonScript);
  try {
    const result = execSync(`python "${tmpFile}" "${key}" "${encryptedValue}"`, { encoding: 'utf8' }).trim();
    return result;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function migrate() {
  console.log('Fernet → AES-256-GCM Migration');
  console.log('================================\n');

  // Verify prerequisites
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY not set in server/.env');
    console.error('Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  if (!fs.existsSync(FERNET_KEY_PATH)) {
    console.error('ERROR: .secret_key file not found (needed for Fernet decryption)');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error('ERROR: adapt.db not found at', DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  
  // Check if llm_provider_config table exists
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='llm_provider_config'"
  ).get();
  
  if (!tableExists) {
    console.log('llm_provider_config table does not exist yet — nothing to migrate.');
    db.close();
    process.exit(0);
  }

  const rows = db.prepare(
    'SELECT config_id, teacher_id, provider, api_key_encrypted FROM llm_provider_config WHERE api_key_encrypted IS NOT NULL'
  ).all();

  if (rows.length === 0) {
    console.log('No encrypted API keys found — nothing to migrate.');
    db.close();
    process.exit(0);
  }

  console.log(`Found ${rows.length} encrypted API key(s) to migrate.\n`);

  const migrateOne = db.prepare(
    'UPDATE llm_provider_config SET api_key_encrypted = ? WHERE config_id = ?'
  );

  const migrateAll = db.transaction((rows) => {
    let success = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        console.log(`  Migrating config_id=${row.config_id} (${row.provider}, teacher_id=${row.teacher_id})...`);
        
        // Step 1: Decrypt with Fernet (via Python)
        const plaintext = decryptFernet(row.api_key_encrypted);
        
        // Step 2: Encrypt with AES-256-GCM
        const newEncrypted = encrypt(plaintext);
        
        // Step 3: Verify roundtrip
        const verified = decrypt(newEncrypted);
        if (verified !== plaintext) {
          throw new Error('Roundtrip verification failed');
        }
        
        // Step 4: Update DB
        migrateOne.run(newEncrypted, row.config_id);
        console.log(`    ✓ migrated`);
        success++;
      } catch (err) {
        console.error(`    ✗ FAILED: ${err.message}`);
        failed++;
      }
    }

    return { success, failed };
  });

  const result = migrateAll(rows);
  
  console.log(`\nMigration complete: ${result.success} succeeded, ${result.failed} failed.`);
  
  if (result.failed > 0) {
    console.log('\nWARNING: Some keys failed to migrate. Check the errors above.');
    console.log('Failed keys still use Fernet encryption — they will not be readable by Node.js.');
  }

  db.close();
  process.exit(result.failed > 0 ? 1 : 0);
}

migrate();
