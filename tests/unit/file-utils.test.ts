import { describe, it, expect, vi } from 'vitest';
import {
  countWords,
  getFileExtension,
  isSupportedFile,
  getFileType,
  computeTextHash,
  computeFileHash,
  SUPPORTED_EXTENSIONS,
} from '@/lib/file-utils';

describe('File Utils', () => {
  describe('countWords', () => {
    it('counts words in a simple sentence', () => {
      expect(countWords('Hello world')).toBe(2);
    });

    it('counts words with multiple spaces', () => {
      expect(countWords('Hello    world')).toBe(2);
    });

    it('counts words with tabs and newlines', () => {
      expect(countWords('Hello\tworld\nfoo bar')).toBe(4);
    });

    it('returns 0 for empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('returns 0 for whitespace-only string', () => {
      expect(countWords('   \t\n   ')).toBe(0);
    });

    it('counts single word', () => {
      expect(countWords('word')).toBe(1);
    });

    it('handles leading and trailing whitespace', () => {
      expect(countWords('  hello world  ')).toBe(2);
    });

    it('counts words in a long paragraph', () => {
      const text = 'The quick brown fox jumps over the lazy dog. This is a test sentence with multiple words.';
      expect(countWords(text)).toBe(17);
    });
  });

  describe('getFileExtension', () => {
    it('extracts pdf extension', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
    });

    it('extracts docx extension', () => {
      expect(getFileExtension('file.docx')).toBe('docx');
    });

    it('returns lowercase extension', () => {
      expect(getFileExtension('File.PDF')).toBe('pdf');
    });

    it('handles multiple dots in filename', () => {
      expect(getFileExtension('my.file.name.epub')).toBe('epub');
    });

    it('returns empty string for no extension', () => {
      expect(getFileExtension('filename')).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(getFileExtension('')).toBe('');
    });

    it('handles dot at start of filename', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
    });
  });

  describe('isSupportedFile', () => {
    it('returns true for pdf files', () => {
      expect(isSupportedFile('document.pdf')).toBe(true);
    });

    it('returns true for docx files', () => {
      expect(isSupportedFile('document.docx')).toBe(true);
    });

    it('returns true for epub files', () => {
      expect(isSupportedFile('book.epub')).toBe(true);
    });

    it('returns true for mobi files', () => {
      expect(isSupportedFile('book.mobi')).toBe(true);
    });

    it('returns true for azw files', () => {
      expect(isSupportedFile('book.azw')).toBe(true);
    });

    it('returns true for azw3 files', () => {
      expect(isSupportedFile('book.azw3')).toBe(true);
    });

    it('handles case insensitivity', () => {
      expect(isSupportedFile('document.PDF')).toBe(true);
      expect(isSupportedFile('document.DOCX')).toBe(true);
      expect(isSupportedFile('book.EPUB')).toBe(true);
    });

    it('returns false for unsupported extensions', () => {
      expect(isSupportedFile('image.jpg')).toBe(false);
      expect(isSupportedFile('document.txt')).toBe(false);
      expect(isSupportedFile('archive.zip')).toBe(false);
    });

    it('handles epub with .zip appended by browser', () => {
      expect(isSupportedFile('book.epub.zip')).toBe(true);
    });

    it('handles path with directories', () => {
      expect(isSupportedFile('/path/to/document.pdf')).toBe(true);
    });
  });

  describe('getFileType', () => {
    it('returns pdf for pdf files', () => {
      expect(getFileType('document.pdf')).toBe('pdf');
    });

    it('returns docx for docx files', () => {
      expect(getFileType('document.docx')).toBe('docx');
    });

    it('returns epub for epub files', () => {
      expect(getFileType('book.epub')).toBe('epub');
    });

    it('returns mobi for mobi files', () => {
      expect(getFileType('book.mobi')).toBe('mobi');
    });

    it('returns mobi for azw files', () => {
      expect(getFileType('book.azw')).toBe('mobi');
    });

    it('returns mobi for azw3 files', () => {
      expect(getFileType('book.azw3')).toBe('mobi');
    });

    it('handles case insensitivity', () => {
      expect(getFileType('document.PDF')).toBe('pdf');
      expect(getFileType('document.DOCX')).toBe('docx');
    });

    it('returns null for unsupported files', () => {
      expect(getFileType('image.jpg')).toBeNull();
      expect(getFileType('document.txt')).toBeNull();
    });

    it('handles epub with .zip appended', () => {
      expect(getFileType('book.epub.zip')).toBe('epub');
    });
  });

  describe('computeTextHash', () => {
    it('returns consistent hash for same input', () => {
      const text = 'Hello world';
      const hash1 = computeTextHash(text);
      const hash2 = computeTextHash(text);
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', () => {
      const hash1 = computeTextHash('Hello world');
      const hash2 = computeTextHash('Goodbye world');
      expect(hash1).not.toBe(hash2);
    });

    it('returns 16 character hex string', () => {
      const hash = computeTextHash('Test content');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('handles empty string', () => {
      const hash = computeTextHash('');
      expect(hash).toHaveLength(16);
    });

    it('handles unicode content', () => {
      const hash = computeTextHash('Hello 世界 emoji 🎉');
      expect(hash).toHaveLength(16);
    });

    it('produces different hashes for similar strings', () => {
      const hash1 = computeTextHash('test');
      const hash2 = computeTextHash('Test');
      const hash3 = computeTextHash('test ');
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('computeFileHash', () => {
    it('computes hash for small file', async () => {
      const content = new Uint8Array([1, 2, 3, 4, 5]);
      const file = new File([content], 'test.pdf');
      
      const hash = await computeFileHash(file);
      
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('returns consistent hash for same content', async () => {
      const content = new Uint8Array([1, 2, 3, 4, 5]);
      const file1 = new File([content], 'test.pdf');
      const file2 = new File([content], 'other.pdf');
      
      const hash1 = await computeFileHash(file1);
      const hash2 = await computeFileHash(file2);
      
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different content', async () => {
      const file1 = new File([new Uint8Array([1, 2, 3])], 'test.pdf');
      const file2 = new File([new Uint8Array([4, 5, 6])], 'test.pdf');
      
      const hash1 = await computeFileHash(file1);
      const hash2 = await computeFileHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty file', async () => {
      const file = new File([], 'empty.pdf');
      
      const hash = await computeFileHash(file);
      
      expect(hash).toHaveLength(16);
    });
  });

  describe('SUPPORTED_EXTENSIONS', () => {
    it('contains all expected extensions', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.pdf');
      expect(SUPPORTED_EXTENSIONS).toContain('.docx');
      expect(SUPPORTED_EXTENSIONS).toContain('.epub');
      expect(SUPPORTED_EXTENSIONS).toContain('.mobi');
      expect(SUPPORTED_EXTENSIONS).toContain('.azw');
      expect(SUPPORTED_EXTENSIONS).toContain('.azw3');
    });

    it('has correct length', () => {
      expect(SUPPORTED_EXTENSIONS).toHaveLength(6);
    });
  });
});
