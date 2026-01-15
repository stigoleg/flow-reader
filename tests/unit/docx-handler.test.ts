import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mammoth library
const mockConvertToHtml = vi.fn();

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: mockConvertToHtml,
  },
  convertToHtml: mockConvertToHtml,
}));

import { extractFromDocx } from '@/lib/docx-handler';

// Create a proper mock File with arrayBuffer method
function createMockFile(name: string, content: string = 'mock content'): File {
  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const file = new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return file;
}

describe('DOCX Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractFromDocx', () => {
    it('extracts text from DOCX file', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>This is the content from a Word document.</p>',
        messages: [],
      });

      const file = createMockFile('test.docx');
      const doc = await extractFromDocx(file);

      expect(doc.metadata.source).toBe('docx');
      expect(doc.metadata.title).toBe('test');
      expect(doc.blocks.length).toBeGreaterThan(0);
    });

    it('removes .docx extension from title', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>Content from the document file.</p>',
        messages: [],
      });

      const file = createMockFile('My Document.DOCX');
      const doc = await extractFromDocx(file);

      expect(doc.metadata.title).toBe('My Document');
    });

    it('removes .doc extension from title', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>Content from older Word format.</p>',
        messages: [],
      });

      const file = createMockFile('Old Format.doc');
      const doc = await extractFromDocx(file);

      expect(doc.metadata.title).toBe('Old Format');
    });

    it('parses multiple paragraphs from HTML', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>First paragraph with enough content.</p><p>Second paragraph with more text.</p>',
        messages: [],
      });

      const file = createMockFile('paragraphs.docx');
      const doc = await extractFromDocx(file);

      expect(doc.blocks.length).toBe(2);
      expect(doc.blocks.every(b => b.type === 'paragraph')).toBe(true);
    });

    it('parses headings from HTML', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<h1>Document Title</h1><p>Content paragraph below the heading.</p>',
        messages: [],
      });

      const file = createMockFile('headings.docx');
      const doc = await extractFromDocx(file);

      expect(doc.blocks.length).toBe(2);
      expect(doc.blocks[0].type).toBe('heading');
      expect(doc.blocks[1].type).toBe('paragraph');
    });

    it('handles lists from DOCX', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<ul><li>First item in the list</li><li>Second item here</li></ul>',
        messages: [],
      });

      const file = createMockFile('list.docx');
      const doc = await extractFromDocx(file);

      expect(doc.blocks.length).toBe(1);
      expect(doc.blocks[0].type).toBe('list');
    });

    it('handles ordered lists from DOCX', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<ol><li>Step one of the process</li><li>Step two continues</li></ol>',
        messages: [],
      });

      const file = createMockFile('numbered-list.docx');
      const doc = await extractFromDocx(file);

      expect(doc.blocks.length).toBe(1);
      expect(doc.blocks[0].type).toBe('list');
    });

    it('generates plainText for RSVP mode', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>First paragraph content.</p><p>Second paragraph content.</p>',
        messages: [],
      });

      const file = createMockFile('test.docx');
      const doc = await extractFromDocx(file);

      expect(doc.plainText).toBeDefined();
      expect(typeof doc.plainText).toBe('string');
      expect(doc.plainText.length).toBeGreaterThan(0);
    });

    it('sets createdAt timestamp', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>Document content for timestamp test.</p>',
        messages: [],
      });

      const before = Date.now();
      const file = createMockFile('test.docx');
      const doc = await extractFromDocx(file);
      const after = Date.now();

      expect(doc.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(doc.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('assigns unique IDs to blocks', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<p>Para one with content.</p><p>Para two here.</p><p>Para three follows.</p>',
        messages: [],
      });

      const file = createMockFile('test.docx');
      const doc = await extractFromDocx(file);

      const ids = doc.blocks.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('throws error on conversion failure', async () => {
      mockConvertToHtml.mockRejectedValue(new Error('Invalid DOCX file'));

      const file = createMockFile('corrupt.docx');

      await expect(extractFromDocx(file)).rejects.toThrow('Invalid DOCX file');
    });

    it('handles empty document', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '',
        messages: [],
      });

      const file = createMockFile('empty.docx');
      const doc = await extractFromDocx(file);

      expect(doc.blocks).toHaveLength(0);
    });

    it('handles tables when handleTables option is used', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>',
        messages: [],
      });

      const file = createMockFile('table.docx');
      const doc = await extractFromDocx(file);

      // Tables should be handled according to parseHtmlToBlocks with handleTables: true
      expect(doc).toBeDefined();
    });

    it('preserves complex document structure', async () => {
      mockConvertToHtml.mockResolvedValue({
        value: `
          <h1>Main Title</h1>
          <p>Introduction paragraph with content.</p>
          <h2>Section One</h2>
          <p>Section one content here.</p>
          <ul>
            <li>Bullet point one</li>
            <li>Bullet point two</li>
          </ul>
          <h2>Section Two</h2>
          <p>Section two content follows.</p>
        `,
        messages: [],
      });

      const file = createMockFile('complex.docx');
      const doc = await extractFromDocx(file);

      // Should have: h1, p, h2, p, ul, h2, p = 7 blocks
      expect(doc.blocks.length).toBe(7);
    });
  });
});
