import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.runtime.getURL before importing the module
vi.stubGlobal('chrome', {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
  },
});

// Mock pdfjs-dist
const mockGetTextContent = vi.fn();
const mockGetPage = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  default: {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: (options: { data: ArrayBuffer }) => ({
      promise: mockGetDocument(options),
    }),
  },
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (options: { data: ArrayBuffer }) => ({
    promise: mockGetDocument(options),
  }),
}));

import { extractFromPdf, hasPdfTextLayer } from '@/lib/pdf-handler';

// Create a proper mock File with arrayBuffer method
function createMockFile(name: string, content: string = 'mock content'): File {
  const blob = new Blob([content], { type: 'application/pdf' });
  const file = new File([blob], name, { type: 'application/pdf' });
  return file;
}

describe('PDF Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractFromPdf', () => {
    it('extracts text from single-page PDF', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [
          { str: 'Hello', hasEOL: false },
          { str: ' ', hasEOL: false },
          { str: 'World', hasEOL: true },
          { str: 'Second line', hasEOL: true },
        ],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('test.pdf');
      const doc = await extractFromPdf(file);

      expect(doc.metadata.source).toBe('pdf');
      expect(doc.metadata.title).toBe('test');
      expect(doc.blocks.length).toBeGreaterThan(0);
    });

    it('extracts text from multi-page PDF', async () => {
      const page1Content = {
        items: [
          { str: 'Page 1 content', hasEOL: true },
          { str: 'More page 1 text', hasEOL: true },
        ],
      };
      const page2Content = {
        items: [
          { str: 'Page 2 content', hasEOL: true },
        ],
      };

      mockGetPage.mockImplementation(async (pageNum: number) => ({
        getTextContent: async () => pageNum === 1 ? page1Content : page2Content,
      }));
      mockGetDocument.mockResolvedValue({
        numPages: 2,
        getPage: mockGetPage,
      });

      const file = createMockFile('multipage.pdf');
      const doc = await extractFromPdf(file);

      expect(doc.metadata.source).toBe('pdf');
      expect(doc.plainText).toContain('Page 1');
      expect(doc.plainText).toContain('Page 2');
    });

    it('removes .pdf extension from title', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [{ str: 'Content that is long enough to be a paragraph.', hasEOL: true }],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('My Document.PDF');
      const doc = await extractFromPdf(file);

      expect(doc.metadata.title).toBe('My Document');
    });

    it('throws error for PDF without text layer', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('scanned.pdf');

      await expect(extractFromPdf(file)).rejects.toThrow('No text could be extracted');
    });

    it('creates blocks from paragraphs', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [
          { str: 'First paragraph with enough content to pass.', hasEOL: true },
          { str: '', hasEOL: true },
          { str: '', hasEOL: true },
          { str: 'Second paragraph here with sufficient length.', hasEOL: true },
        ],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('paragraphs.pdf');
      const doc = await extractFromPdf(file);

      // Two paragraphs split by double newline
      expect(doc.blocks.length).toBe(2);
      expect(doc.blocks[0].type).toBe('paragraph');
    });

    it('assigns unique IDs to blocks', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [
          { str: 'First paragraph with long content here.', hasEOL: true },
          { str: '', hasEOL: true },
          { str: 'Second paragraph is also very long.', hasEOL: true },
          { str: '', hasEOL: true },
          { str: 'Third paragraph continues the pattern.', hasEOL: true },
        ],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('test.pdf');
      const doc = await extractFromPdf(file);

      const ids = doc.blocks.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('generates plainText for RSVP mode', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [
          { str: 'First paragraph content for the document.', hasEOL: true },
          { str: '', hasEOL: true },
          { str: 'Second paragraph with additional text.', hasEOL: true },
        ],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('test.pdf');
      const doc = await extractFromPdf(file);

      expect(doc.plainText).toBeDefined();
      expect(typeof doc.plainText).toBe('string');
      expect(doc.plainText.length).toBeGreaterThan(0);
    });

    it('sets createdAt timestamp', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [{ str: 'Content that is long enough to be valid.', hasEOL: true }],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const before = Date.now();
      const file = createMockFile('test.pdf');
      const doc = await extractFromPdf(file);
      const after = Date.now();

      expect(doc.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(doc.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('handles PDF with empty pages gracefully', async () => {
      mockGetPage.mockImplementation(async (pageNum: number) => ({
        getTextContent: async () => pageNum === 1 
          ? { items: [] }
          : { items: [{ str: 'Content on page 2 that has enough text.', hasEOL: true }] },
      }));
      mockGetDocument.mockResolvedValue({
        numPages: 2,
        getPage: mockGetPage,
      });

      const file = createMockFile('mixed.pdf');
      const doc = await extractFromPdf(file);

      expect(doc.blocks.length).toBeGreaterThan(0);
    });
  });

  describe('hasPdfTextLayer', () => {
    it('returns true for PDF with text', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [{ str: 'Some text', hasEOL: true }],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('test.pdf');
      const result = await hasPdfTextLayer(file);

      expect(result.hasText).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns false for PDF without text', async () => {
      mockGetTextContent.mockResolvedValue({
        items: [],
      });
      mockGetPage.mockResolvedValue({
        getTextContent: mockGetTextContent,
      });
      mockGetDocument.mockResolvedValue({
        numPages: 1,
        getPage: mockGetPage,
      });

      const file = createMockFile('scanned.pdf');
      const result = await hasPdfTextLayer(file);

      expect(result.hasText).toBe(false);
    });

    it('returns false with empty error for empty PDF', async () => {
      mockGetDocument.mockResolvedValue({
        numPages: 0,
        getPage: mockGetPage,
      });

      const file = createMockFile('empty.pdf');
      const result = await hasPdfTextLayer(file);

      expect(result.hasText).toBe(false);
      expect(result.error).toBe('empty');
    });

    it('returns false with corrupted error on PDF parsing error', async () => {
      mockGetDocument.mockRejectedValue(new Error('Invalid PDF'));

      const file = createMockFile('corrupt.pdf');
      const result = await hasPdfTextLayer(file);

      expect(result.hasText).toBe(false);
      expect(result.error).toBe('corrupted');
    });

    it('returns password-protected error for encrypted PDFs', async () => {
      mockGetDocument.mockRejectedValue(new Error('password required'));

      const file = createMockFile('protected.pdf');
      const result = await hasPdfTextLayer(file);

      expect(result.hasText).toBe(false);
      expect(result.error).toBe('password-protected');
    });
  });
});
