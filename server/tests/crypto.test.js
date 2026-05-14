import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, redact } from '../src/services/crypto';

describe('Crypto service', () => {
  describe('encrypt()', () => {
    it('encrypt() produces a non-empty string', () => {
      const result = encrypt('hello world');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('encrypt() output contains three colon-separated segments (iv:tag:ciphertext)', () => {
      const result = encrypt('test-value');
      const parts = result.split(':');
      expect(parts.length).toBe(3);
      parts.forEach((part) => {
        expect(part.length).toBeGreaterThan(0);
      });
    });

    it('encrypt() produces different output on each call (random IV)', () => {
      const result1 = encrypt('same-input');
      const result2 = encrypt('same-input');
      expect(result1).not.toBe(result2);
    });
  });

  describe('decrypt()', () => {
    it('decrypt(encrypt(x)) === x round-trip', () => {
      const original = 'sk-my-secret-api-key-12345';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('decrypt(encrypt(x)) round-trip works for string with special characters', () => {
      const original = 'sk-proj-ABC123!@#xyz';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('encrypt("") produces format with empty ciphertext segment', () => {
      const result = encrypt('');
      const parts = result.split(':');
      expect(parts.length).toBe(3);
      expect(parts[2]).toBe('');
    });

    it('decrypt() throws on invalid ciphertext format', () => {
      expect(() => {
        decrypt('not-valid-ciphertext');
      }).toThrow(/Invalid ciphertext format/);
    });
  });

  describe('redact()', () => {
    it('redact() masks middle of long strings with ellipsis character', () => {
      const result = redact('sk-1234567890abcdef');
      expect(result.includes('\u2026')).toBe(true);
      expect(result.startsWith('sk-')).toBe(true);
      expect(result.endsWith('cdef')).toBe(true);
    });

    it('redact() returns all asterisks for short strings (length <= 6)', () => {
      const result = redact('short');
      expect(result).toBe('*****');
    });

    it('redact() returns all asterisks for strings of length 6', () => {
      const result = redact('123456');
      expect(result).toBe('******');
    });

    it('redact() correctly redacts 7-character string', () => {
      const result = redact('1234567');
      expect(result).toBe('123\u20264567');
    });

    it('redact() returns empty string for falsy input', () => {
      expect(redact('')).toBe('');
      expect(redact(null)).toBe('');
      expect(redact(undefined)).toBe('');
    });
  });
});