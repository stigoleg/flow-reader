import { describe, it, expect, beforeEach } from 'vitest';
import { 
  normalizeArticleMarkup, 
  setNormalizeDebug,
  getNormalizeLogs,
  ALLOWED_BLOCK_TAGS,
  ALLOWED_INLINE_TAGS,
} from '@/lib/article-normalize';

// Helper to create a DOM element from HTML string
function createDOM(html: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body;
}

describe('Article Normalization', () => {
  beforeEach(() => {
    setNormalizeDebug(false);
  });

  describe('Constants', () => {
    it('exports allowed block tags', () => {
      expect(ALLOWED_BLOCK_TAGS.has('h2')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('h3')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('p')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('ul')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('ol')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('li')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('blockquote')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('pre')).toBe(true);
      expect(ALLOWED_BLOCK_TAGS.has('code')).toBe(true);
    });

    it('exports allowed inline tags', () => {
      expect(ALLOWED_INLINE_TAGS.has('a')).toBe(true);
      expect(ALLOWED_INLINE_TAGS.has('strong')).toBe(true);
      expect(ALLOWED_INLINE_TAGS.has('em')).toBe(true);
      expect(ALLOWED_INLINE_TAGS.has('code')).toBe(true);
    });
  });

  describe('Allowed Tags Preservation', () => {
    it('keeps h2, h3, p, ul, ol, blockquote, pre', () => {
      const root = createDOM(`
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <p>Paragraph</p>
        <ul><li>Unordered item</li></ul>
        <ol><li>Ordered item</li></ol>
        <blockquote>Quote</blockquote>
        <pre><code>code block</code></pre>
      `);
      normalizeArticleMarkup(root);
      expect(root.querySelector('h2')).not.toBeNull();
      expect(root.querySelector('h3')).not.toBeNull();
      expect(root.querySelector('p')).not.toBeNull();
      expect(root.querySelector('ul')).not.toBeNull();
      expect(root.querySelector('ol')).not.toBeNull();
      expect(root.querySelector('blockquote')).not.toBeNull();
      expect(root.querySelector('pre')).not.toBeNull();
    });

    it('keeps li elements inside lists', () => {
      const root = createDOM(`<ul><li>Item 1</li><li>Item 2</li></ul>`);
      normalizeArticleMarkup(root);
      expect(root.querySelectorAll('li')).toHaveLength(2);
    });
  });

  describe('H1 Removal', () => {
    it('removes h1 from body (title comes from metadata)', () => {
      const root = createDOM('<h1>Title</h1><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('h1')).toBeNull();
      expect(root.querySelector('p')).not.toBeNull();
    });

    it('removes multiple h1 elements', () => {
      const root = createDOM('<h1>Title 1</h1><h1>Title 2</h1><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelectorAll('h1')).toHaveLength(0);
    });
  });

  describe('Heading Level Conversion', () => {
    it('converts h4 to h3', () => {
      const root = createDOM('<h4>H4 Title</h4><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('h4')).toBeNull();
      expect(root.querySelector('h3')?.textContent).toBe('H4 Title');
    });

    it('converts h5 to h3', () => {
      const root = createDOM('<h5>H5 Title</h5><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('h5')).toBeNull();
      expect(root.querySelector('h3')?.textContent).toBe('H5 Title');
    });

    it('converts h6 to h3', () => {
      const root = createDOM('<h6>H6 Title</h6><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('h6')).toBeNull();
      expect(root.querySelector('h3')?.textContent).toBe('H6 Title');
    });

    it('converts multiple lower headings', () => {
      const root = createDOM(`
        <h4>H4</h4>
        <h5>H5</h5>
        <h6>H6</h6>
      `);
      normalizeArticleMarkup(root);
      expect(root.querySelectorAll('h3')).toHaveLength(3);
      expect(root.querySelector('h4')).toBeNull();
      expect(root.querySelector('h5')).toBeNull();
      expect(root.querySelector('h6')).toBeNull();
    });
  });

  describe('Container Unwrapping', () => {
    it('unwraps div wrappers', () => {
      const root = createDOM('<div><p>Content</p></div>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('div')).toBeNull();
      expect(root.querySelector('p')?.textContent).toBe('Content');
    });

    it('unwraps section elements', () => {
      const root = createDOM('<section><p>Content</p></section>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('section')).toBeNull();
      expect(root.querySelector('p')?.textContent).toBe('Content');
    });

    it('unwraps article elements', () => {
      const root = createDOM('<article><p>Content</p></article>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('article')).toBeNull();
    });

    it('unwraps main elements', () => {
      const root = createDOM('<main><p>Content</p></main>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('main')).toBeNull();
    });

    it('unwraps nested containers', () => {
      const root = createDOM(`
        <article><section><div><main><p>Deep</p></main></div></section></article>
      `);
      normalizeArticleMarkup(root);
      expect(root.querySelector('article')).toBeNull();
      expect(root.querySelector('section')).toBeNull();
      expect(root.querySelector('div')).toBeNull();
      expect(root.querySelector('main')).toBeNull();
      expect(root.querySelector('p')?.textContent).toBe('Deep');
    });

    it('unwraps font elements', () => {
      const root = createDOM('<font color="red"><p>Text</p></font>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('font')).toBeNull();
    });

    it('unwraps center elements', () => {
      const root = createDOM('<center><p>Centered</p></center>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('center')).toBeNull();
    });
  });

  describe('Attribute Stripping', () => {
    it('removes style attributes', () => {
      const root = createDOM('<p style="color: red; font-size: 18px;">Text</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.hasAttribute('style')).toBe(false);
    });

    it('removes class attributes', () => {
      const root = createDOM('<p class="intro lead-para">Text</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.hasAttribute('class')).toBe(false);
    });

    it('removes id attributes', () => {
      const root = createDOM('<p id="intro">Text</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.hasAttribute('id')).toBe(false);
    });

    it('removes data attributes', () => {
      const root = createDOM('<p data-track="click" data-id="123">Text</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.hasAttribute('data-track')).toBe(false);
      expect(root.querySelector('p')?.hasAttribute('data-id')).toBe(false);
    });

    it('preserves href on anchors', () => {
      const root = createDOM('<p><a href="https://example.com" class="link">Link</a></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
      expect(root.querySelector('a')?.hasAttribute('class')).toBe(false);
    });

    it('preserves language class on code elements', () => {
      const root = createDOM('<pre><code class="language-javascript other-class">code</code></pre>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('code')?.getAttribute('class')).toBe('language-javascript');
    });

    it('removes non-language classes from code elements', () => {
      const root = createDOM('<pre><code class="highlight code-block">code</code></pre>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('code')?.hasAttribute('class')).toBe(false);
    });
  });

  describe('Span Handling', () => {
    it('unwraps spans with no semantic value', () => {
      const root = createDOM('<p><span>Just text</span></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('span')).toBeNull();
      expect(root.querySelector('p')?.textContent).toBe('Just text');
    });

    it('unwraps spans with only class/style', () => {
      const root = createDOM('<p><span class="highlight" style="color: red;">Styled</span></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('span')).toBeNull();
    });

    it('unwraps nested redundant spans', () => {
      const root = createDOM('<p><span><span><span>Nested</span></span></span></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('span')).toBeNull();
      expect(root.querySelector('p')?.textContent).toBe('Nested');
    });

    it('removes spans matching non-content patterns', () => {
      const root = createDOM(`
        <p>Text <span class="share-button">Share</span> more text</p>
      `);
      normalizeArticleMarkup(root);
      expect(root.textContent).not.toContain('Share');
    });

    it('removes caption-class spans', () => {
      const root = createDOM('<p><span class="image-caption">Caption</span></p>');
      normalizeArticleMarkup(root);
      expect(root.textContent).not.toContain('Caption');
    });

    it('removes byline-class spans', () => {
      const root = createDOM('<p><span class="byline">By Author</span></p>');
      normalizeArticleMarkup(root);
      expect(root.textContent).not.toContain('By Author');
    });

    it('removes promo-class spans', () => {
      const root = createDOM('<p><span class="promo-text">Promo!</span></p>');
      normalizeArticleMarkup(root);
      expect(root.textContent).not.toContain('Promo');
    });
  });

  describe('Inline Semantics Preservation', () => {
    it('preserves strong elements', () => {
      const root = createDOM('<p><strong>Bold text</strong></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('strong')?.textContent).toBe('Bold text');
    });

    it('preserves em elements', () => {
      const root = createDOM('<p><em>Italic text</em></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('em')?.textContent).toBe('Italic text');
    });

    it('converts b to strong', () => {
      const root = createDOM('<p><b>Bold</b></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('b')).toBeNull();
      expect(root.querySelector('strong')?.textContent).toBe('Bold');
    });

    it('converts i to em', () => {
      const root = createDOM('<p><i>Italic</i></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('i')).toBeNull();
      expect(root.querySelector('em')?.textContent).toBe('Italic');
    });

    it('preserves anchors with valid href', () => {
      const root = createDOM('<p><a href="https://example.com">Link</a></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('a')?.textContent).toBe('Link');
      expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    });

    it('unwraps anchors without href', () => {
      const root = createDOM('<p><a>Not a link</a></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('a')).toBeNull();
      expect(root.querySelector('p')?.textContent).toBe('Not a link');
    });

    it('unwraps anchors with # href', () => {
      const root = createDOM('<p><a href="#">Hash link</a></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('a')).toBeNull();
    });

    it('unwraps anchors with javascript href', () => {
      const root = createDOM('<p><a href="javascript:void(0)">JS link</a></p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('a')).toBeNull();
    });

    it('preserves inline code elements', () => {
      const root = createDOM('<p>Use <code>const</code> for constants.</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('code')?.textContent).toBe('const');
    });
  });

  describe('Code Block Preservation', () => {
    it('preserves pre/code structure', () => {
      const root = createDOM('<pre><code>function test() {}</code></pre>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('pre')).not.toBeNull();
      expect(root.querySelector('code')).not.toBeNull();
    });

    it('preserves whitespace in pre elements', () => {
      const root = createDOM('<pre>  indented\n  code  </pre>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('pre')?.textContent).toContain('  indented');
    });

    it('does not unwrap spans inside code', () => {
      const root = createDOM('<pre><code><span class="keyword">const</span> x = 1;</code></pre>');
      normalizeArticleMarkup(root);
      // Spans inside code should be preserved for syntax highlighting
      expect(root.querySelector('pre code')?.textContent).toContain('const');
    });
  });

  describe('Table Handling', () => {
    it('removes low-content tables', () => {
      const root = createDOM(`
        <table><tr><td>A</td><td>B</td></tr></table>
        <p>Content</p>
      `);
      normalizeArticleMarkup(root);
      expect(root.querySelector('table')).toBeNull();
    });

    it('converts text-heavy tables to paragraphs', () => {
      const root = createDOM(`
        <table>
          <tr><th>Header with substantial text content here</th><th>Another column header</th></tr>
          <tr><td>Cell content that is long enough to pass the threshold for text density</td><td>More cell content</td></tr>
          <tr><td>Additional row with more text content for the table</td><td>Even more text</td></tr>
          <tr><td>Yet another row of meaningful content in this table</td><td>Final cell</td></tr>
        </table>
      `);
      normalizeArticleMarkup(root);
      expect(root.querySelector('table')).toBeNull();
      // Should have paragraphs with pipe-separated content
      const paragraphs = root.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThan(0);
    });
  });

  describe('BR Element Handling', () => {
    it('removes single br elements', () => {
      const root = createDOM('<p>Line one<br>Line two</p>');
      normalizeArticleMarkup(root);
      // Single br should be removed (CSS handles spacing)
      expect(root.querySelectorAll('br').length).toBeLessThanOrEqual(0);
    });

    it('preserves br inside pre elements', () => {
      const root = createDOM('<pre>Line 1<br>Line 2</pre>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('pre')?.innerHTML).toContain('Line 1');
    });
  });

  describe('Whitespace Normalization', () => {
    it('collapses repeated whitespace', () => {
      const root = createDOM('<p>Text    with   multiple    spaces</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.textContent).toBe('Text with multiple spaces');
    });

    it('collapses newlines and tabs', () => {
      const root = createDOM('<p>Text\n\n\twith\n\t\twhitespace</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.textContent).toBe('Text with whitespace');
    });

    it('trims leading whitespace from block elements', () => {
      const root = createDOM('<p>   Leading spaces</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.textContent).toBe('Leading spaces');
    });

    it('trims trailing whitespace from block elements', () => {
      const root = createDOM('<p>Trailing spaces   </p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('p')?.textContent).toBe('Trailing spaces');
    });

    it('preserves whitespace in pre/code', () => {
      const root = createDOM('<pre>  indented   code  </pre>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('pre')?.textContent).toContain('  indented');
    });
  });

  describe('Non-Content Element Removal', () => {
    it('removes script elements', () => {
      const root = createDOM('<script>alert("hi")</script><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('script')).toBeNull();
    });

    it('removes style elements', () => {
      const root = createDOM('<style>.red { color: red; }</style><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('style')).toBeNull();
    });

    it('removes input elements', () => {
      const root = createDOM('<input type="text"><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('input')).toBeNull();
    });

    it('removes button elements', () => {
      const root = createDOM('<button>Click</button><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('button')).toBeNull();
    });

    it('removes noscript elements', () => {
      const root = createDOM('<noscript>Enable JS</noscript><p>Content</p>');
      normalizeArticleMarkup(root);
      expect(root.querySelector('noscript')).toBeNull();
    });
  });

  describe('Debug Mode', () => {
    it('logs normalizations when debug is enabled', () => {
      setNormalizeDebug(true);
      const root = createDOM('<div><p>Content</p></div>');
      normalizeArticleMarkup(root);
      const logs = getNormalizeLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('clears logs when debug is disabled', () => {
      setNormalizeDebug(true);
      const root = createDOM('<div>Test</div>');
      normalizeArticleMarkup(root);
      expect(getNormalizeLogs().length).toBeGreaterThan(0);
      
      setNormalizeDebug(false);
      expect(getNormalizeLogs()).toHaveLength(0);
    });
  });

  describe('Integration - Messy Formatting', () => {
    it('normalizes article with excessive formatting', () => {
      const root = createDOM(`
        <div style="padding: 20px;">
          <div class="wrapper">
            <p style="font-size: 14px; color: blue;">
              <span class="highlight">
                <span>Nested text content here.</span>
              </span>
            </p>
          </div>
        </div>
        <p id="intro" class="lead" style="font-weight: bold;">Another paragraph.</p>
        <h4>Subheading</h4>
      `);
      normalizeArticleMarkup(root);
      
      // No divs
      expect(root.querySelector('div')).toBeNull();
      // No spans
      expect(root.querySelector('span')).toBeNull();
      // No style attributes
      expect(root.querySelector('[style]')).toBeNull();
      // No class/id on paragraphs
      expect(root.querySelector('p[class]')).toBeNull();
      expect(root.querySelector('p[id]')).toBeNull();
      // H4 converted to H3
      expect(root.querySelector('h4')).toBeNull();
      expect(root.querySelector('h3')).not.toBeNull();
      // Content preserved
      expect(root.textContent).toContain('Nested text content');
      expect(root.textContent).toContain('Another paragraph');
    });
  });
});
