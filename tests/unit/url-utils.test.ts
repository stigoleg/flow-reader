import { describe, it, expect } from 'vitest';
import { normalizeUrl, hashString } from '@/lib/url-utils';

describe('URL Utils', () => {
  describe('normalizeUrl', () => {
    it('lowercases hostname', () => {
      const result = normalizeUrl('https://EXAMPLE.COM/path');
      expect(result).toContain('example.com');
    });

    it('removes www prefix', () => {
      const result = normalizeUrl('https://www.example.com/path');
      expect(result).toBe('https://example.com/path');
    });

    it('removes trailing slash from pathname', () => {
      const result = normalizeUrl('https://example.com/path/');
      expect(result).toBe('https://example.com/path');
    });

    it('keeps root slash', () => {
      const result = normalizeUrl('https://example.com/');
      expect(result).toBe('https://example.com/');
    });

    it('removes utm_source parameter', () => {
      const result = normalizeUrl('https://example.com/path?utm_source=twitter');
      expect(result).toBe('https://example.com/path');
    });

    it('removes utm_medium parameter', () => {
      const result = normalizeUrl('https://example.com/path?utm_medium=social');
      expect(result).toBe('https://example.com/path');
    });

    it('removes utm_campaign parameter', () => {
      const result = normalizeUrl('https://example.com/path?utm_campaign=launch');
      expect(result).toBe('https://example.com/path');
    });

    it('removes utm_term parameter', () => {
      const result = normalizeUrl('https://example.com/path?utm_term=keyword');
      expect(result).toBe('https://example.com/path');
    });

    it('removes utm_content parameter', () => {
      const result = normalizeUrl('https://example.com/path?utm_content=cta');
      expect(result).toBe('https://example.com/path');
    });

    it('removes fbclid parameter', () => {
      const result = normalizeUrl('https://example.com/path?fbclid=abc123');
      expect(result).toBe('https://example.com/path');
    });

    it('removes gclid parameter', () => {
      const result = normalizeUrl('https://example.com/path?gclid=abc123');
      expect(result).toBe('https://example.com/path');
    });

    it('removes ref parameter', () => {
      const result = normalizeUrl('https://example.com/path?ref=twitter');
      expect(result).toBe('https://example.com/path');
    });

    it('removes multiple tracking parameters', () => {
      const result = normalizeUrl('https://example.com/path?utm_source=twitter&utm_medium=social&fbclid=123');
      expect(result).toBe('https://example.com/path');
    });

    it('preserves non-tracking parameters', () => {
      const result = normalizeUrl('https://example.com/path?page=2&sort=date');
      expect(result).toContain('page=2');
      expect(result).toContain('sort=date');
    });

    it('sorts remaining search params', () => {
      const result = normalizeUrl('https://example.com/path?z=1&a=2&m=3');
      // Params should be sorted alphabetically
      expect(result).toBe('https://example.com/path?a=2&m=3&z=1');
    });

    it('removes hash/fragment', () => {
      const result = normalizeUrl('https://example.com/path#section1');
      expect(result).toBe('https://example.com/path');
    });

    it('handles complex URL with all transformations', () => {
      const result = normalizeUrl(
        'https://WWW.EXAMPLE.COM/path/to/page/?utm_source=google&id=123&fbclid=abc#section'
      );
      expect(result).toBe('https://example.com/path/to/page?id=123');
    });

    it('returns lowercase for invalid URL', () => {
      const result = normalizeUrl('not a valid url');
      expect(result).toBe('not a valid url');
    });

    it('handles empty string', () => {
      const result = normalizeUrl('');
      expect(result).toBe('');
    });

    it('normalizes identical URLs consistently', () => {
      const url1 = 'https://www.EXAMPLE.com/path/?utm_source=a';
      const url2 = 'https://example.com/path?utm_medium=b';
      
      expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
    });

    it('handles URLs with ports', () => {
      const result = normalizeUrl('https://example.com:8080/path');
      expect(result).toBe('https://example.com:8080/path');
    });

    it('handles URLs with auth', () => {
      const result = normalizeUrl('https://user:pass@example.com/path');
      expect(result).toBe('https://user:pass@example.com/path');
    });

    it('preserves protocol', () => {
      const httpResult = normalizeUrl('http://example.com/path');
      expect(httpResult).toContain('http://');
      
      const httpsResult = normalizeUrl('https://example.com/path');
      expect(httpsResult).toContain('https://');
    });
  });

  describe('hashString', () => {
    it('returns consistent hash for same input', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('hello');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', () => {
      const hash1 = hashString('hello');
      const hash2 = hashString('world');
      expect(hash1).not.toBe(hash2);
    });

    it('returns base36 string', () => {
      const hash = hashString('test string');
      // Base36 uses 0-9 and a-z
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });

    it('handles empty string', () => {
      const hash = hashString('');
      expect(hash).toBe('0');
    });

    it('handles unicode strings', () => {
      const hash = hashString('Hello 世界');
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });

    it('produces different hashes for similar strings', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('Test');
      const hash3 = hashString('test ');
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('handles very long strings', () => {
      const longString = 'a'.repeat(10000);
      const hash = hashString(longString);
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });
  });
});
