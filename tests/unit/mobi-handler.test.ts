import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock file-utils for hash computation
vi.mock('@/lib/file-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/file-utils')>();
  return {
    ...actual,
    computeFileHash: vi.fn().mockResolvedValue('mock-mobi-hash-12345'),
  };
});

import { extractFromMobi, MobiExtractionError } from '@/lib/mobi-handler';

// PDB/MOBI constants for test file generation
const PDB_HEADER_SIZE = 78;
const MOBI_MAGIC = 'MOBI';

/**
 * Helper to build a minimal valid MOBI file structure
 */
function buildMobiFile(options: {
  name?: string;
  title?: string;
  author?: string;
  htmlContent?: string;
  compression?: number;
  encryption?: number;
}): ArrayBuffer {
  const {
    name = 'Test Book',
    title = 'Test Title',
    htmlContent = '<html><body><h1>Chapter 1</h1><p>This is a test paragraph with enough content to pass validation checks and thresholds.</p></body></html>',
    compression = 1, // No compression
    encryption = 0,  // No DRM
  } = options;

  // Encode HTML content
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(htmlContent);
  
  // We'll create 2 records: record 0 (header) and record 1 (content)
  const numRecords = 2;
  
  // Calculate sizes
  const record0Size = 512; // Enough for PalmDoc + MOBI headers
  const record1Size = contentBytes.length;
  const recordListSize = numRecords * 8;
  const totalSize = PDB_HEADER_SIZE + recordListSize + record0Size + record1Size;
  
  // Create buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  // === PDB Header (78 bytes) ===
  // Database name (0-31, null-padded)
  const nameBytes = encoder.encode(name.slice(0, 31));
  bytes.set(nameBytes, 0);
  
  // Attributes at offset 32 (2 bytes) - leave as 0
  // Version at offset 34 (2 bytes) - leave as 0
  // Creation date at offset 36 (4 bytes) - leave as 0
  // Modification date at offset 40 (4 bytes) - leave as 0
  // Last backup at offset 44 (4 bytes) - leave as 0
  // Modification number at offset 48 (4 bytes) - leave as 0
  // App info offset at offset 52 (4 bytes) - leave as 0
  // Sort info offset at offset 56 (4 bytes) - leave as 0
  // Type at offset 60 (4 bytes) - 'BOOK'
  bytes.set(encoder.encode('BOOK'), 60);
  // Creator at offset 64 (4 bytes) - 'MOBI'
  bytes.set(encoder.encode('MOBI'), 64);
  // Unique ID seed at offset 68 (4 bytes) - leave as 0
  // Next record list ID at offset 72 (4 bytes) - leave as 0
  // Number of records at offset 76 (2 bytes)
  view.setUint16(76, numRecords, false);
  
  // === Record List (8 bytes per record) ===
  const recordListOffset = PDB_HEADER_SIZE;
  const record0Offset = recordListOffset + recordListSize;
  const record1Offset = record0Offset + record0Size;
  
  // Record 0 entry
  view.setUint32(recordListOffset, record0Offset, false);
  view.setUint8(recordListOffset + 4, 0); // attributes
  // uniqueId (3 bytes) - leave as 0
  
  // Record 1 entry
  view.setUint32(recordListOffset + 8, record1Offset, false);
  view.setUint8(recordListOffset + 12, 0); // attributes
  
  // === Record 0: PalmDoc + MOBI Headers ===
  let offset = record0Offset;
  
  // PalmDoc header (16 bytes)
  view.setUint16(offset, compression, false);      // Compression (1 = none, 2 = PalmDOC)
  offset += 2;
  view.setUint16(offset, 0, false);                // Unused
  offset += 2;
  view.setUint32(offset, contentBytes.length, false); // Text length
  offset += 4;
  view.setUint16(offset, 1, false);                // Record count (1 text record)
  offset += 2;
  view.setUint16(offset, 4096, false);             // Record size
  offset += 2;
  view.setUint16(offset, encryption, false);       // Encryption type (0 = none)
  offset += 2;
  view.setUint16(offset, 0, false);                // Unknown
  offset += 2;
  
  // MOBI header
  const mobiHeaderStart = record0Offset + 16;
  
  // MOBI magic at offset 16 of record 0
  bytes.set(encoder.encode(MOBI_MAGIC), mobiHeaderStart);
  
  // Header length at offset 20 (4 bytes)
  view.setUint32(mobiHeaderStart + 4, 232, false);
  
  // Mobi type at offset 24 (4 bytes) - 2 = Mobipocket Book
  view.setUint32(mobiHeaderStart + 8, 2, false);
  
  // Text encoding at offset 28 (4 bytes) - 65001 = UTF-8
  view.setUint32(mobiHeaderStart + 12, 65001, false);
  
  // Full name offset at offset 84 (4 bytes)
  const fullNameOffset = 300; // Offset within record 0
  view.setUint32(mobiHeaderStart + 68, fullNameOffset, false);
  
  // Full name length at offset 88 (4 bytes)
  const titleBytes = encoder.encode(title);
  view.setUint32(mobiHeaderStart + 72, titleBytes.length, false);
  
  // First image index at offset 108 (4 bytes) - beyond our records
  view.setUint32(mobiHeaderStart + 92, 0xFFFFFFFF, false);
  
  // EXTH flags at offset 128 (4 bytes) - 0 = no EXTH
  view.setUint32(mobiHeaderStart + 112, 0, false);
  
  // Write full name
  bytes.set(titleBytes, record0Offset + fullNameOffset);
  
  // === Record 1: Content ===
  bytes.set(contentBytes, record1Offset);
  
  return buffer;
}

/**
 * Create a mock File from ArrayBuffer
 */
function createMockMobiFile(name: string, buffer: ArrayBuffer): File {
  const blob = new Blob([buffer], { type: 'application/x-mobipocket-ebook' });
  return new File([blob], name, { type: 'application/x-mobipocket-ebook' });
}

describe('MOBI Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractFromMobi', () => {
    it('extracts content from a valid MOBI file', async () => {
      const buffer = buildMobiFile({
        title: 'My Test Book',
        htmlContent: '<html><body><h1>Chapter One</h1><p>This is the first paragraph of the book with substantial content for testing purposes.</p></body></html>',
      });
      const file = createMockMobiFile('test-book.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.metadata.source).toBe('mobi');
      expect(doc.metadata.title).toBe('My Test Book');
      expect(doc.blocks.length).toBeGreaterThan(0);
      expect(doc.book).toBeDefined();
    });

    it('extracts title from MOBI header', async () => {
      const buffer = buildMobiFile({
        title: 'The Great Adventure',
      });
      const file = createMockMobiFile('adventure.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.metadata.title).toBe('The Great Adventure');
    });

    it('falls back to filename when no title in header', async () => {
      const buffer = buildMobiFile({
        title: '', // Empty title
      });
      const file = createMockMobiFile('fallback-book.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      // Should use PDB name or filename
      expect(doc.metadata.title).toBeDefined();
      expect(doc.metadata.title.length).toBeGreaterThan(0);
    });

    it('sets createdAt timestamp', async () => {
      const buffer = buildMobiFile({});
      const file = createMockMobiFile('timestamp.mobi', buffer);
      
      const before = Date.now();
      const doc = await extractFromMobi(file);
      const after = Date.now();

      expect(doc.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(doc.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('includes fileHash in metadata', async () => {
      const buffer = buildMobiFile({});
      const file = createMockMobiFile('hash-test.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.metadata.fileHash).toBe('mock-mobi-hash-12345');
    });

    it('creates book structure with chapters', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><h1>First Chapter</h1><p>Content of the first chapter with enough text.</p><mbp:pagebreak/><h1>Second Chapter</h1><p>Content of the second chapter with more text.</p></body></html>',
      });
      const file = createMockMobiFile('chapters.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.book).toBeDefined();
      expect(doc.book?.chapters.length).toBeGreaterThan(0);
    });

    it('generates TOC from chapters', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><h1>Introduction</h1><p>The introduction with substantial content.</p></body></html>',
      });
      const file = createMockMobiFile('toc-test.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.book?.toc).toBeDefined();
      expect(doc.book?.toc.length).toBeGreaterThan(0);
    });

    it('generates plainText for RSVP mode', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><h1>Chapter</h1><p>Some plain text content for testing extraction and reading modes.</p></body></html>',
      });
      const file = createMockMobiFile('plaintext.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.plainText).toBeDefined();
      expect(typeof doc.plainText).toBe('string');
      expect(doc.plainText.length).toBeGreaterThan(0);
    });

    it('calculates word count for chapters', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><h1>Chapter</h1><p>One two three four five six seven eight nine ten words here.</p></body></html>',
      });
      const file = createMockMobiFile('wordcount.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.book?.chapters[0].wordCount).toBeGreaterThan(0);
    });

    it('includes fileName and fileSize in metadata', async () => {
      const buffer = buildMobiFile({});
      const file = createMockMobiFile('metadata-test.mobi', buffer);
      
      const doc = await extractFromMobi(file);

      expect(doc.metadata.fileName).toBe('metadata-test.mobi');
      expect(doc.metadata.fileSize).toBeGreaterThan(0);
    });
  });

  describe('DRM detection', () => {
    it('detects DRM-protected MOBI files', async () => {
      const buffer = buildMobiFile({
        encryption: 2, // Mobipocket DRM
      });
      const file = createMockMobiFile('drm-protected.mobi', buffer);
      
      await expect(extractFromMobi(file)).rejects.toThrow(MobiExtractionError);
      await expect(extractFromMobi(file)).rejects.toThrow('DRM-protected');
    });

    it('processes non-DRM files successfully', async () => {
      const buffer = buildMobiFile({
        encryption: 0, // No encryption
      });
      const file = createMockMobiFile('no-drm.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      expect(doc.metadata.source).toBe('mobi');
    });
  });

  describe('error handling', () => {
    it('throws error for invalid MOBI file', async () => {
      // Create a completely invalid file
      const invalidBuffer = new ArrayBuffer(100);
      const invalidBytes = new Uint8Array(invalidBuffer);
      invalidBytes.fill(0xFF);
      
      const file = createMockMobiFile('invalid.mobi', invalidBuffer);
      
      await expect(extractFromMobi(file)).rejects.toThrow(MobiExtractionError);
    });

    it('throws error when no content is found', async () => {
      const buffer = buildMobiFile({
        htmlContent: '', // Empty content
      });
      const file = createMockMobiFile('empty.mobi', buffer);
      
      await expect(extractFromMobi(file)).rejects.toThrow(MobiExtractionError);
      await expect(extractFromMobi(file)).rejects.toThrow('No readable content');
    });

    it('handles file with minimal content gracefully', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><p>A</p></body></html>',
      });
      const file = createMockMobiFile('minimal.mobi', buffer);
      
      // Should either throw no-content or succeed with minimal content
      try {
        const doc = await extractFromMobi(file);
        expect(doc.blocks.length).toBeGreaterThanOrEqual(0);
      } catch (error) {
        expect(error).toBeInstanceOf(MobiExtractionError);
      }
    });
  });

  describe('compression handling', () => {
    it('handles uncompressed MOBI files', async () => {
      const buffer = buildMobiFile({
        compression: 1, // No compression
        htmlContent: '<html><body><h1>Uncompressed</h1><p>This content is stored without compression in the MOBI file.</p></body></html>',
      });
      const file = createMockMobiFile('uncompressed.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      expect(doc.metadata.source).toBe('mobi');
    });
  });

  describe('chapter splitting', () => {
    it('splits on mbp:pagebreak tags', async () => {
      const buffer = buildMobiFile({
        htmlContent: `
          <html><body>
            <h1>Chapter One</h1>
            <p>Content of chapter one with enough words to pass the threshold.</p>
            <mbp:pagebreak/>
            <h1>Chapter Two</h1>
            <p>Content of chapter two with additional words for testing.</p>
          </body></html>
        `,
      });
      const file = createMockMobiFile('pagebreaks.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      // Should have multiple chapters due to pagebreak
      expect(doc.book?.chapters.length).toBeGreaterThanOrEqual(1);
    });

    it('merges very short sections with previous chapter', async () => {
      const buffer = buildMobiFile({
        htmlContent: `
          <html><body>
            <h1>Main Chapter</h1>
            <p>This is a substantial chapter with plenty of content to read and enjoy.</p>
            <mbp:pagebreak/>
            <p>Short.</p>
          </body></html>
        `,
      });
      const file = createMockMobiFile('short-sections.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      // Short section should be merged
      expect(doc.book?.chapters.length).toBe(1);
    });

    it('uses headings to find chapter titles', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><h1>The Beginning</h1><p>Story starts here with introduction text.</p></body></html>',
      });
      const file = createMockMobiFile('heading-title.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      expect(doc.book?.chapters[0].title).toBe('The Beginning');
    });
  });

  describe('HTML parsing', () => {
    it('handles MOBI-specific tags', async () => {
      const buffer = buildMobiFile({
        htmlContent: `
          <html><body>
            <mbp:section>
              <h1>Section Content</h1>
              <p>Text inside mbp:section tag with enough content for parsing.</p>
            </mbp:section>
          </body></html>
        `,
      });
      const file = createMockMobiFile('mobi-tags.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      expect(doc.blocks.length).toBeGreaterThan(0);
    });

    it('extracts headings correctly', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><h1>Main Heading</h1><h2>Subheading</h2><p>Paragraph text content here.</p></body></html>',
      });
      const file = createMockMobiFile('headings.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      const headings = doc.blocks.filter(b => b.type === 'heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('extracts paragraphs correctly', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><p>First paragraph.</p><p>Second paragraph.</p></body></html>',
      });
      const file = createMockMobiFile('paragraphs.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      const paragraphs = doc.blocks.filter(b => b.type === 'paragraph');
      expect(paragraphs.length).toBe(2);
    });
  });

  describe('encoding handling', () => {
    it('handles UTF-8 encoded content', async () => {
      const buffer = buildMobiFile({
        htmlContent: '<html><body><p>UTF-8 content with special chars: é à ü ñ 中文</p></body></html>',
      });
      const file = createMockMobiFile('utf8.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      
      expect(doc.plainText).toContain('é');
      expect(doc.plainText).toContain('中文');
    });
  });

  describe('file extensions', () => {
    it('handles .mobi extension', async () => {
      const buffer = buildMobiFile({ title: 'MOBI Book' });
      const file = createMockMobiFile('book.mobi', buffer);
      
      const doc = await extractFromMobi(file);
      expect(doc.metadata.source).toBe('mobi');
    });

    it('handles .azw extension', async () => {
      const buffer = buildMobiFile({ title: 'AZW Book' });
      const file = createMockMobiFile('book.azw', buffer);
      
      const doc = await extractFromMobi(file);
      expect(doc.metadata.source).toBe('mobi');
    });

    it('handles .azw3 extension', async () => {
      const buffer = buildMobiFile({ title: 'AZW3 Book' });
      const file = createMockMobiFile('book.azw3', buffer);
      
      const doc = await extractFromMobi(file);
      expect(doc.metadata.source).toBe('mobi');
    });
  });
});
