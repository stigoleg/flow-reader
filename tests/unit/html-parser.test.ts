import { describe, it, expect } from 'vitest';
import { parseHtmlToBlocks } from '@/lib/html-parser';

describe('HTML Parser', () => {
  describe('parseHtmlToBlocks', () => {
    describe('headings', () => {
      it('parses h1 heading', () => {
        const blocks = parseHtmlToBlocks('<h1>Main Title</h1>');
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('heading');
        if (blocks[0].type === 'heading') {
          expect(blocks[0].level).toBe(1);
          expect(blocks[0].content).toBe('Main Title');
        }
      });

      it('parses h2 through h6 headings', () => {
        const html = `
          <h2>Level 2</h2>
          <h3>Level 3</h3>
          <h4>Level 4</h4>
          <h5>Level 5</h5>
          <h6>Level 6</h6>
        `;
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(5);
        
        const levels = blocks.map(b => b.type === 'heading' ? b.level : null);
        expect(levels).toEqual([2, 3, 4, 5, 6]);
      });

      it('ignores empty headings', () => {
        const blocks = parseHtmlToBlocks('<h1></h1><h2>   </h2><h3>Real</h3>');
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('heading');
      });
    });

    describe('paragraphs', () => {
      it('parses simple paragraph', () => {
        const blocks = parseHtmlToBlocks('<p>This is a paragraph.</p>');
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('paragraph');
        if (blocks[0].type === 'paragraph') {
          expect(blocks[0].content).toBe('This is a paragraph.');
        }
      });

      it('parses multiple paragraphs', () => {
        const html = '<p>First paragraph.</p><p>Second paragraph.</p>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(2);
        expect(blocks.every(b => b.type === 'paragraph')).toBe(true);
      });

      it('ignores empty paragraphs', () => {
        const blocks = parseHtmlToBlocks('<p></p><p>Content</p><p>  </p>');
        expect(blocks).toHaveLength(1);
      });

      it('trims whitespace from paragraphs', () => {
        const blocks = parseHtmlToBlocks('<p>  Trimmed content  </p>');
        expect(blocks).toHaveLength(1);
        if (blocks[0].type === 'paragraph') {
          expect(blocks[0].content).toBe('Trimmed content');
        }
      });
    });

    describe('lists', () => {
      it('parses unordered list', () => {
        const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('list');
        if (blocks[0].type === 'list') {
          expect(blocks[0].ordered).toBe(false);
          expect(blocks[0].items).toEqual(['Item 1', 'Item 2', 'Item 3']);
        }
      });

      it('parses ordered list', () => {
        const html = '<ol><li>First</li><li>Second</li></ol>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('list');
        if (blocks[0].type === 'list') {
          expect(blocks[0].ordered).toBe(true);
          expect(blocks[0].items).toEqual(['First', 'Second']);
        }
      });

      it('ignores empty list items', () => {
        const html = '<ul><li>Valid</li><li></li><li>  </li></ul>';
        const blocks = parseHtmlToBlocks(html);
        if (blocks[0].type === 'list') {
          expect(blocks[0].items).toEqual(['Valid']);
        }
      });

      it('ignores empty lists', () => {
        const html = '<ul></ul><ol><li>Item</li></ol>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(1);
      });
    });

    describe('blockquotes', () => {
      it('parses blockquote', () => {
        const blocks = parseHtmlToBlocks('<blockquote>A famous quote.</blockquote>');
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('quote');
        if (blocks[0].type === 'quote') {
          expect(blocks[0].content).toBe('A famous quote.');
        }
      });

      it('ignores empty blockquotes', () => {
        const blocks = parseHtmlToBlocks('<blockquote></blockquote><blockquote>Real</blockquote>');
        expect(blocks).toHaveLength(1);
      });
    });

    describe('code blocks', () => {
      it('parses pre element as code block', () => {
        const blocks = parseHtmlToBlocks('<pre>const x = 1;</pre>');
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('code');
        if (blocks[0].type === 'code') {
          expect(blocks[0].content).toBe('const x = 1;');
        }
      });

      it('parses pre with code element', () => {
        const blocks = parseHtmlToBlocks('<pre><code>function test() {}</code></pre>');
        expect(blocks).toHaveLength(1);
        if (blocks[0].type === 'code') {
          expect(blocks[0].content).toBe('function test() {}');
        }
      });

      it('extracts language from code class', () => {
        const blocks = parseHtmlToBlocks('<pre><code class="language-javascript">const x = 1;</code></pre>');
        expect(blocks).toHaveLength(1);
        if (blocks[0].type === 'code') {
          expect(blocks[0].language).toBe('javascript');
        }
      });

      it('handles missing language class', () => {
        const blocks = parseHtmlToBlocks('<pre><code>no language</code></pre>');
        if (blocks[0].type === 'code') {
          expect(blocks[0].language).toBeUndefined();
        }
      });
    });

    describe('tables', () => {
      it('ignores tables by default', () => {
        const html = '<table><tr><td>Cell</td></tr></table><p>After table</p>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('paragraph');
      });

      it('converts tables to paragraphs when handleTables is true', () => {
        const html = `
          <table>
            <tr><th>Header 1</th><th>Header 2</th></tr>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </table>
        `;
        const blocks = parseHtmlToBlocks(html, { handleTables: true });
        expect(blocks).toHaveLength(2);
        expect(blocks.every(b => b.type === 'paragraph')).toBe(true);
        
        if (blocks[0].type === 'paragraph') {
          expect(blocks[0].content).toBe('Header 1 | Header 2');
        }
        if (blocks[1].type === 'paragraph') {
          expect(blocks[1].content).toBe('Cell 1 | Cell 2');
        }
      });
    });

    describe('nested content', () => {
      it('processes nested elements recursively', () => {
        const html = '<div><p>Nested paragraph.</p><h2>Nested heading</h2></div>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(2);
        expect(blocks[0].type).toBe('paragraph');
        expect(blocks[1].type).toBe('heading');
      });

      it('handles deeply nested content', () => {
        const html = '<article><section><div><p>Deep content.</p></div></section></article>';
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(1);
        if (blocks[0].type === 'paragraph') {
          expect(blocks[0].content).toBe('Deep content.');
        }
      });
    });

    describe('mixed content', () => {
      it('parses complete article structure', () => {
        const html = `
          <h1>Article Title</h1>
          <p>Introduction paragraph.</p>
          <h2>Section One</h2>
          <p>Section content.</p>
          <ul>
            <li>Point one</li>
            <li>Point two</li>
          </ul>
          <blockquote>A relevant quote.</blockquote>
          <pre><code class="language-python">print("hello")</code></pre>
        `;
        const blocks = parseHtmlToBlocks(html);
        expect(blocks).toHaveLength(7);
        
        expect(blocks[0].type).toBe('heading');
        expect(blocks[1].type).toBe('paragraph');
        expect(blocks[2].type).toBe('heading');
        expect(blocks[3].type).toBe('paragraph');
        expect(blocks[4].type).toBe('list');
        expect(blocks[5].type).toBe('quote');
        expect(blocks[6].type).toBe('code');
      });
    });

    describe('ID generation', () => {
      it('assigns unique IDs to all blocks', () => {
        const html = '<p>One</p><p>Two</p><p>Three</p>';
        const blocks = parseHtmlToBlocks(html);
        
        const ids = blocks.map(b => b.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });

      it('generates IDs in format block-N', () => {
        const blocks = parseHtmlToBlocks('<p>Test</p>');
        expect(blocks[0].id).toMatch(/^block-\d+$/);
      });
    });

    describe('edge cases', () => {
      it('handles empty HTML', () => {
        const blocks = parseHtmlToBlocks('');
        expect(blocks).toEqual([]);
      });

      it('handles whitespace-only HTML', () => {
        const blocks = parseHtmlToBlocks('   \n\t   ');
        expect(blocks).toEqual([]);
      });

      it('handles plain text (no elements)', () => {
        // Plain text without wrapper elements won't be captured
        // since we only process element nodes
        const blocks = parseHtmlToBlocks('Just plain text');
        expect(blocks).toEqual([]);
      });
    });
  });
});
