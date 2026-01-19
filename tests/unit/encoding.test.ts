import { describe, it, expect } from 'vitest';
import {
  arrayBufferToBase64,
  base64ToUint8Array,
  unicodeToBase64,
  base64ToUnicode,
  toArrayBuffer,
} from '@/lib/encoding';

describe('Encoding Utils', () => {
  describe('arrayBufferToBase64', () => {
    it('converts empty array buffer', () => {
      const buffer = new ArrayBuffer(0);
      expect(arrayBufferToBase64(buffer)).toBe('');
    });

    it('converts simple bytes', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(arrayBufferToBase64(bytes)).toBe('SGVsbG8=');
    });

    it('converts Uint8Array directly', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const result = arrayBufferToBase64(bytes);
      expect(result).toBe('AQIDBAU=');
    });

    it('converts ArrayBuffer', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const result = arrayBufferToBase64(buffer);
      expect(result).toBe('AQID');
    });

    it('handles binary data with all byte values', () => {
      const bytes = new Uint8Array([0, 127, 128, 255]);
      const result = arrayBufferToBase64(bytes);
      // Should not throw and should return valid base64
      expect(result).toBeTruthy();
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });

  describe('base64ToUint8Array', () => {
    it('converts empty base64 string', () => {
      const result = base64ToUint8Array('');
      expect(result).toHaveLength(0);
    });

    it('converts simple base64 to bytes', () => {
      const result = base64ToUint8Array('SGVsbG8='); // "Hello"
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('converts base64 without padding', () => {
      const result = base64ToUint8Array('AQID');
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('handles binary data round-trip', () => {
      const original = new Uint8Array([0, 127, 128, 255]);
      const base64 = arrayBufferToBase64(original);
      const result = base64ToUint8Array(base64);
      expect(result).toEqual(original);
    });
  });

  describe('arrayBufferToBase64 and base64ToUint8Array round-trip', () => {
    it('preserves data in round-trip', () => {
      const original = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
      const base64 = arrayBufferToBase64(original);
      const result = base64ToUint8Array(base64);
      expect(result).toEqual(original);
    });

    it('handles large data', () => {
      const original = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        original[i] = i % 256;
      }
      const base64 = arrayBufferToBase64(original);
      const result = base64ToUint8Array(base64);
      expect(result).toEqual(original);
    });
  });

  describe('unicodeToBase64', () => {
    it('converts ASCII string', () => {
      const result = unicodeToBase64('Hello');
      expect(result).toBe('SGVsbG8=');
    });

    it('converts empty string', () => {
      const result = unicodeToBase64('');
      expect(result).toBe('');
    });

    it('converts unicode string with non-Latin1 characters', () => {
      const result = unicodeToBase64('Hello 世界');
      // Should not throw and should return valid base64
      expect(result).toBeTruthy();
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });

    it('converts emoji', () => {
      const result = unicodeToBase64('Hello 🎉');
      expect(result).toBeTruthy();
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });

    it('converts various unicode scripts', () => {
      const texts = [
        'Привет мир',      // Cyrillic
        'مرحبا بالعالم',   // Arabic
        'שלום עולם',       // Hebrew
        'こんにちは世界',    // Japanese
        '안녕하세요',        // Korean
      ];

      for (const text of texts) {
        const base64 = unicodeToBase64(text);
        expect(base64).toBeTruthy();
        expect(base64).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
      }
    });
  });

  describe('base64ToUnicode', () => {
    it('converts ASCII base64 back to string', () => {
      const result = base64ToUnicode('SGVsbG8=');
      expect(result).toBe('Hello');
    });

    it('converts empty base64 to empty string', () => {
      const result = base64ToUnicode('');
      expect(result).toBe('');
    });
  });

  describe('unicodeToBase64 and base64ToUnicode round-trip', () => {
    it('preserves ASCII text', () => {
      const original = 'Hello World!';
      const base64 = unicodeToBase64(original);
      const result = base64ToUnicode(base64);
      expect(result).toBe(original);
    });

    it('preserves unicode text with Chinese characters', () => {
      const original = 'Hello 世界';
      const base64 = unicodeToBase64(original);
      const result = base64ToUnicode(base64);
      expect(result).toBe(original);
    });

    it('preserves emoji', () => {
      const original = 'Hello 🎉🚀✨';
      const base64 = unicodeToBase64(original);
      const result = base64ToUnicode(base64);
      expect(result).toBe(original);
    });

    it('preserves mixed script text', () => {
      const original = 'English, 日本語, עברית, العربية';
      const base64 = unicodeToBase64(original);
      const result = base64ToUnicode(base64);
      expect(result).toBe(original);
    });

    it('preserves special characters', () => {
      const original = '<script>alert("xss")</script>';
      const base64 = unicodeToBase64(original);
      const result = base64ToUnicode(base64);
      expect(result).toBe(original);
    });

    it('preserves newlines and whitespace', () => {
      const original = 'Line 1\nLine 2\tTabbed';
      const base64 = unicodeToBase64(original);
      const result = base64ToUnicode(base64);
      expect(result).toBe(original);
    });
  });

  describe('toArrayBuffer', () => {
    it('converts Uint8Array to ArrayBuffer', () => {
      const uint8 = new Uint8Array([1, 2, 3]);
      const result = toArrayBuffer(uint8);
      
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(3);
    });

    it('handles empty Uint8Array', () => {
      const uint8 = new Uint8Array(0);
      const result = toArrayBuffer(uint8);
      
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(0);
    });

    it('preserves data', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const buffer = toArrayBuffer(original);
      const restored = new Uint8Array(buffer);
      
      expect(restored).toEqual(original);
    });

    it('handles Uint8Array from slice (with offset)', () => {
      const base = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const slice = base.subarray(2, 5); // [2, 3, 4]
      
      const buffer = toArrayBuffer(slice);
      const restored = new Uint8Array(buffer);
      
      expect(restored).toEqual(new Uint8Array([2, 3, 4]));
    });
  });
});
