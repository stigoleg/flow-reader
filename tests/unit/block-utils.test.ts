import { describe, it, expect } from 'vitest';
import { getBlockText, getPlainText, createDocument } from '@/lib/block-utils';
import type { Block, HeadingBlock, ParagraphBlock, ListBlock, QuoteBlock, CodeBlock } from '@/types';

describe('Block Utils', () => {
  describe('getBlockText', () => {
    it('extracts text from paragraph block', () => {
      const block: ParagraphBlock = {
        type: 'paragraph',
        content: 'This is a paragraph.',
        id: 'p1',
      };
      expect(getBlockText(block)).toBe('This is a paragraph.');
    });

    it('extracts text from heading block', () => {
      const block: HeadingBlock = {
        type: 'heading',
        level: 1,
        content: 'Main Title',
        id: 'h1',
      };
      expect(getBlockText(block)).toBe('Main Title');
    });

    it('extracts text from quote block', () => {
      const block: QuoteBlock = {
        type: 'quote',
        content: 'A famous quote.',
        id: 'q1',
      };
      expect(getBlockText(block)).toBe('A famous quote.');
    });

    it('extracts text from code block', () => {
      const block: CodeBlock = {
        type: 'code',
        content: 'const x = 1;',
        language: 'javascript',
        id: 'c1',
      };
      expect(getBlockText(block)).toBe('const x = 1;');
    });

    it('joins list items with spaces', () => {
      const block: ListBlock = {
        type: 'list',
        ordered: false,
        items: ['First item', 'Second item', 'Third item'],
        id: 'l1',
      };
      expect(getBlockText(block)).toBe('First item Second item Third item');
    });

    it('handles empty list', () => {
      const block: ListBlock = {
        type: 'list',
        ordered: true,
        items: [],
        id: 'l2',
      };
      expect(getBlockText(block)).toBe('');
    });

    it('handles single list item', () => {
      const block: ListBlock = {
        type: 'list',
        ordered: true,
        items: ['Only item'],
        id: 'l3',
      };
      expect(getBlockText(block)).toBe('Only item');
    });
  });

  describe('getPlainText', () => {
    it('combines multiple blocks with spaces', () => {
      const blocks: Block[] = [
        { type: 'paragraph', content: 'First paragraph.', id: 'p1' },
        { type: 'paragraph', content: 'Second paragraph.', id: 'p2' },
      ];
      expect(getPlainText(blocks)).toBe('First paragraph. Second paragraph.');
    });

    it('handles mixed block types', () => {
      const blocks: Block[] = [
        { type: 'heading', level: 1, content: 'Title', id: 'h1' },
        { type: 'paragraph', content: 'Content here.', id: 'p1' },
        { type: 'list', ordered: false, items: ['Item one', 'Item two'], id: 'l1' },
      ];
      expect(getPlainText(blocks)).toBe('Title Content here. Item one Item two');
    });

    it('returns empty string for empty blocks array', () => {
      expect(getPlainText([])).toBe('');
    });

    it('handles single block', () => {
      const blocks: Block[] = [
        { type: 'paragraph', content: 'Only one.', id: 'p1' },
      ];
      expect(getPlainText(blocks)).toBe('Only one.');
    });
  });

  describe('createDocument', () => {
    it('creates document with metadata and blocks', () => {
      const blocks: Block[] = [
        { type: 'paragraph', content: 'Test content.', id: 'p1' },
      ];
      const doc = createDocument(blocks, {
        title: 'Test Document',
        source: 'web',
        url: 'https://example.com',
      });

      expect(doc.metadata.title).toBe('Test Document');
      expect(doc.metadata.source).toBe('web');
      expect(doc.metadata.url).toBe('https://example.com');
      expect(doc.blocks).toBe(blocks);
      expect(doc.plainText).toBe('Test content.');
    });

    it('adds createdAt timestamp', () => {
      const before = Date.now();
      const doc = createDocument([], {
        title: 'Test',
        source: 'paste',
      });
      const after = Date.now();

      expect(doc.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(doc.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('handles optional metadata fields', () => {
      const doc = createDocument([], {
        title: 'Test',
        source: 'pdf',
        author: 'John Doe',
        publishedAt: '2024-01-15',
      });

      expect(doc.metadata.author).toBe('John Doe');
      expect(doc.metadata.publishedAt).toBe('2024-01-15');
      expect(doc.metadata.url).toBeUndefined();
    });

    it('generates correct plainText from multiple blocks', () => {
      const blocks: Block[] = [
        { type: 'heading', level: 1, content: 'Chapter One', id: 'h1' },
        { type: 'paragraph', content: 'Introduction text.', id: 'p1' },
        { type: 'paragraph', content: 'More content here.', id: 'p2' },
      ];
      const doc = createDocument(blocks, {
        title: 'Book',
        source: 'docx',
      });

      expect(doc.plainText).toBe('Chapter One Introduction text. More content here.');
    });
  });
});
