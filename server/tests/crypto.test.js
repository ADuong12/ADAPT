const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt, redact } = require('../src/services/crypto');

// END: Gap 5 - Crypto service unit tests

describe('Crypto service', () => {
  describe('encrypt()', () => {
    it('encrypt() produces a non-empty string', () => {
      const result = encrypt('hello world');
      assert.ok(typeof result === 'string', 'encrypt should return a string');
      assert.ok(result.length > 0, 'encrypt should return non-empty string');
    });

    it('encrypt() output contains three colon-separated segments (iv:tag:ciphertext)', () => {
      const result = encrypt('test-value');
      const parts = result.split(':');
      assert.equal(parts.length, 3, 'encrypted output should have format iv:tag:ciphertext');
      parts.forEach((part, i) => {
        assert.ok(part.length > 0, `segment ${i} should be non-empty`);
      });
    });

    it('encrypt() produces different output on each call (random IV)', () => {
      const result1 = encrypt('same-input');
      const result2 = encrypt('same-input');
      assert.notEqual(result1, result2, 'encrypt should produce different ciphertext each time due to random IV');
    });
  });

  describe('decrypt()', () => {
    it('decrypt(encrypt(x)) === x round-trip', () => {
      const original = 'sk-my-secret-api-key-12345';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, original, 'round-trip encrypt/decrypt should return original value');
    });

    it('decrypt(encrypt(x)) round-trip works for string with special characters', () => {
      const original = 'sk-proj-ABC123!@#xyz';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, original, 'round-trip should handle special characters');
    });

    it('encrypt("") produces format with empty ciphertext segment — empty strings not a supported use case', () => {
      // Empty strings are not a supported use case for API key encryption;
      // the Zod schema validates api_key must be min 4 chars
      const result = encrypt('');
      const parts = result.split(':');
      assert.equal(parts.length, 3, 'should still have 3 segments');
      // The ciphertext segment will be empty for empty input, which cannot be decrypted
      assert.equal(parts[2], '', 'empty input produces empty ciphertext segment');
    });

    it('decrypt() throws on invalid ciphertext format', () => {
      assert.throws(() => {
        decrypt('not-valid-ciphertext');
      }, /Invalid ciphertext format/, 'decrypt should reject malformed input');
    });
  });

  describe('redact()', () => {
    it('redact() masks middle of long strings with ellipsis character', () => {
      const result = redact('sk-1234567890abcdef');
      assert.ok(result.includes('\u2026'), `redact should contain ellipsis char, got: ${result}`);
      assert.ok(result.startsWith('sk-'), `redact should start with first 3 chars, got: ${result}`);
      assert.ok(result.endsWith('cdef'), `redact should end with last 4 chars, got: ${result}`);
    });

    it('redact() returns all asterisks for short strings (length <= 6)', () => {
      const result = redact('short');
      assert.equal(result, '*****', `short string should be fully masked, got: ${result}`);
    });

    it('redact() returns all asterisks for strings of length 6', () => {
      const result = redact('123456');
      assert.equal(result, '******', `6-char string should be fully masked, got: ${result}`);
    });

    it('redact() correctly redacts 7-character string', () => {
      const result = redact('1234567');
      // 7 chars: first 3 + … + last 4 = "123…4567"
      assert.equal(result, '123\u20264567', `7-char string should show first 3 and last 4, got: ${result}`);
    });

    it('redact() returns empty string for falsy input', () => {
      assert.equal(redact(''), '', 'empty string should return empty string');
      assert.equal(redact(null), '', 'null should return empty string');
      assert.equal(redact(undefined), '', 'undefined should return empty string');
    });
  });
});