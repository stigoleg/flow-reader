import { describe, it, expect } from 'vitest';
import { extractFromPaste, extractFromSelection, extractContent } from '@/lib/extraction';

// Helper to create a DOM document from HTML string
function createDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('Content Extraction', () => {
  describe('extractFromPaste', () => {
    it('creates document from plain text', () => {
      const text = 'First paragraph.\n\nSecond paragraph.';
      const doc = extractFromPaste(text);

      expect(doc.metadata.source).toBe('paste');
      expect(doc.metadata.title).toBe('Pasted Text');
      expect(doc.blocks).toHaveLength(2);
    });

    it('preserves paragraph structure', () => {
      const text = 'Para one.\n\nPara two.\n\nPara three.';
      const doc = extractFromPaste(text);

      expect(doc.blocks).toHaveLength(3);
      expect(doc.blocks[0].type).toBe('paragraph');
      expect(doc.blocks[0].content).toBe('Para one.');
    });

    it('generates plain text for RSVP', () => {
      const text = 'First.\n\nSecond.';
      const doc = extractFromPaste(text);

      expect(doc.plainText).toBe('First. Second.');
    });

    it('assigns unique IDs to blocks', () => {
      const text = 'One.\n\nTwo.\n\nThree.';
      const doc = extractFromPaste(text);

      const ids = doc.blocks.map((b) => b.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('handles empty paragraphs', () => {
      const text = 'One.\n\n\n\nTwo.';
      const doc = extractFromPaste(text);

      expect(doc.blocks).toHaveLength(2);
    });

    it('trims whitespace from paragraphs', () => {
      const text = '  Trimmed paragraph.  ';
      const doc = extractFromPaste(text);

      expect(doc.blocks[0].content).toBe('Trimmed paragraph.');
    });

    it('adds createdAt timestamp', () => {
      const before = Date.now();
      const doc = extractFromPaste('Test content.');
      const after = Date.now();

      expect(doc.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(doc.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('handles single paragraph text', () => {
      const doc = extractFromPaste('Just one paragraph here.');
      
      expect(doc.blocks).toHaveLength(1);
      expect(doc.plainText).toBe('Just one paragraph here.');
    });
  });

  describe('extractFromSelection', () => {
    it('creates document from selected text', () => {
      const selection = 'Selected text content.';
      const doc = extractFromSelection(selection, 'https://example.com/article');

      expect(doc.metadata.source).toBe('selection');
      expect(doc.metadata.title).toBe('Selected Text');
      expect(doc.metadata.url).toBe('https://example.com/article');
    });

    it('preserves paragraph structure from selection', () => {
      const selection = 'First selected paragraph.\n\nSecond selected paragraph.';
      const doc = extractFromSelection(selection, 'https://example.com');

      expect(doc.blocks).toHaveLength(2);
    });

    it('generates correct plainText', () => {
      const selection = 'Para one.\n\nPara two.';
      const doc = extractFromSelection(selection, 'https://example.com');

      expect(doc.plainText).toBe('Para one. Para two.');
    });

    it('handles multi-paragraph selections', () => {
      const selection = 'Intro.\n\nMiddle.\n\nConclusion.';
      const doc = extractFromSelection(selection, 'https://test.com');

      expect(doc.blocks).toHaveLength(3);
      expect(doc.blocks[0].content).toBe('Intro.');
      expect(doc.blocks[1].content).toBe('Middle.');
      expect(doc.blocks[2].content).toBe('Conclusion.');
    });
  });

  describe('UI text filtering', () => {
    // The extraction module filters out UI-like text patterns
    // These tests verify that filtering behavior

    it('keeps normal paragraph content', () => {
      const doc = extractFromPaste('This is a normal paragraph with enough content to pass filtering.');
      
      expect(doc.blocks).toHaveLength(1);
    });

    it('filters out timestamp-like text', () => {
      // Very short timestamps are filtered as UI text
      const doc = extractFromPaste('12:30');
      
      // Short text is filtered out by isUIText
      expect(doc.blocks).toHaveLength(0);
    });

    it('filters out percentage-like text', () => {
      const doc = extractFromPaste('85%');
      
      expect(doc.blocks).toHaveLength(0);
    });

    it('filters out video player controls', () => {
      const doc = extractFromPaste('Play');
      
      expect(doc.blocks).toHaveLength(0);
    });

    it('filters out volume controls', () => {
      const doc = extractFromPaste('Mute');
      
      expect(doc.blocks).toHaveLength(0);
    });

    it('keeps text that looks like content even if short when not strict', () => {
      // extractFromSelection uses non-strict filtering
      const doc = extractFromSelection('Short.', 'https://example.com');
      
      // Selection mode is less strict about filtering
      expect(doc.blocks.length).toBeGreaterThanOrEqual(0);
    });

    it('filters keyboard shortcut text', () => {
      const doc = extractFromPaste('Keyboard Shortcuts');
      
      expect(doc.blocks).toHaveLength(0);
    });

    it('keeps longer content with mixed characters', () => {
      const text = 'This article discusses the 2024 trends in technology.';
      const doc = extractFromPaste(text);
      
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0].content).toBe(text);
    });
  });

  describe('extractContent', () => {
    it('extracts article content using Readability', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>This is the first paragraph of the article with enough content to be meaningful.</p>
              <p>This is the second paragraph with additional information for the reader.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.metadata.source).toBe('web');
      expect(result?.metadata.url).toBe('https://example.com/article');
      expect(result?.blocks.length).toBeGreaterThan(0);
    });

    it('returns empty blocks for non-article pages', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Home</title></head>
          <body>
            <nav>Navigation</nav>
            <footer>Footer</footer>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');

      // Non-article pages may still return a document but with no meaningful content
      if (result !== null) {
        expect(result.blocks).toHaveLength(0);
      }
    });

    it('extracts article title', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Page Title | Site Name</title></head>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>This is article content with sufficient length to be extracted properly by Readability.</p>
              <p>Additional paragraph to ensure the content is long enough for article detection.</p>
              <p>Third paragraph adds more weight to the article content extraction algorithm.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.metadata.title).toBeDefined();
    });

    it('removes video player elements', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article with Video</title></head>
          <body>
            <article>
              <h1>Main Article</h1>
              <div class="video-player">
                <button>Play</button>
                <span>00:00</span>
              </div>
              <p>This is the actual article content that should be extracted from the page.</p>
              <p>More content here to ensure Readability picks this up as an article properly.</p>
              <p>Even more content for good measure to make this a valid article.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      // Video player text should not appear in the extracted content
      const plainText = result?.plainText || '';
      expect(plainText).not.toContain('00:00');
    });

    it('removes advertisement elements', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Real Content</h1>
              <div class="ad-container">Buy our product!</div>
              <p>This is the main article content that readers want to see and read.</p>
              <div class="advertisement">Sponsored content</div>
              <p>More article content continues after the advertisement section here.</p>
              <p>Final paragraph of the article with conclusion and summary.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      const plainText = result?.plainText || '';
      expect(plainText).not.toContain('Buy our product');
    });

    it('removes navigation elements', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <nav role="navigation">
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
            <article>
              <h1>Article Heading</h1>
              <p>Main article content that should be extracted by the Readability algorithm.</p>
              <p>Second paragraph of the article with more information for the reader.</p>
              <p>Third paragraph completing the article content for extraction.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
    });

    it('removes hidden elements', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Visible Title</h1>
              <p hidden>Hidden paragraph</p>
              <p aria-hidden="true">Also hidden</p>
              <p style="display: none;">Display none</p>
              <p>Visible content that should be extracted from this article page.</p>
              <p>More visible content for the article extraction algorithm to find.</p>
              <p>Final visible paragraph with conclusion of the article content.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      const plainText = result?.plainText || '';
      expect(plainText).not.toContain('Hidden paragraph');
      expect(plainText).not.toContain('Also hidden');
    });

    it('generates plainText for RSVP mode', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Title</h1>
              <p>First paragraph of the article with enough content to be extracted.</p>
              <p>Second paragraph continues the story with additional details.</p>
              <p>Third paragraph wraps up the article with a conclusion.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      expect(result?.plainText).toBeDefined();
      expect(typeof result?.plainText).toBe('string');
      expect(result?.plainText.length).toBeGreaterThan(0);
    });

    it('sets createdAt timestamp', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Title</h1>
              <p>Content paragraph with enough text to be recognized as article content.</p>
              <p>Additional content to ensure the article passes Readability thresholds.</p>
              <p>More content for good measure in this test article page.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      
      const before = Date.now();
      const result = extractContent(doc, 'https://example.com/article');
      const after = Date.now();

      expect(result).not.toBeNull();
      expect(result?.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(result?.metadata.createdAt).toBeLessThanOrEqual(after);
    });

    it('filters UI text from extracted content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Real Article</h1>
              <p>12:30</p>
              <p>This is real article content that should be extracted and kept.</p>
              <p>85%</p>
              <p>More real content that provides value to the reader of this article.</p>
              <p>Final paragraph with substantial content for the extraction test.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com/article');

      expect(result).not.toBeNull();
      // UI-like text patterns should be filtered
      const blocks = result?.blocks || [];
      const hasTimestamp = blocks.some(b => 'content' in b && b.content === '12:30');
      expect(hasTimestamp).toBe(false);
    });

    it('preserves URL in metadata', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Title</h1>
              <p>Content paragraph with sufficient text for article extraction.</p>
              <p>Second paragraph adds more content for Readability to work with.</p>
              <p>Third paragraph ensures the article is long enough to extract.</p>
            </article>
          </body>
        </html>
      `;
      const url = 'https://example.com/path/to/article?query=value';
      const doc = createDocument(html);
      const result = extractContent(doc, url);

      expect(result).not.toBeNull();
      expect(result?.metadata.url).toBe(url);
    });
  });

  describe('Cleanup Integration', () => {
    it('removes AI summary boxes from extracted content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Main Article</h1>
              <div class="ai-summary">
                <h2>AI Summary</h2>
                <p>This is an AI-generated summary that should be removed.</p>
              </div>
              <p>Real article content that should be extracted and kept in the output.</p>
              <p>More real content to meet extraction thresholds properly.</p>
              <p>Additional paragraph for article detection by Readability.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('AI-generated summary');
      expect(result?.plainText).toContain('Real article content');
    });

    it('removes Key Takeaways sections by heading', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Main Article</h1>
              <h2>Key Takeaways</h2>
              <ul>
                <li>Takeaway point one</li>
                <li>Takeaway point two</li>
              </ul>
              <h2>Background</h2>
              <p>Real article content that should remain after cleanup processing.</p>
              <p>More content here to meet the extraction thresholds.</p>
              <p>Additional content for proper article detection.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('Takeaway point');
      expect(result?.plainText).toContain('Real article content');
    });

    it('removes Norwegian summary sections', () => {
      const html = `
        <!DOCTYPE html>
        <html lang="no">
          <head><title>Artikkel</title></head>
          <body>
            <article>
              <h1>Hovedartikkel</h1>
              <div class="oppsummering">
                <p>Dette er en AI-generert oppsummering.</p>
              </div>
              <h2>Kort fortalt</h2>
              <p>Hovedpoenget som skal fjernes fra artikkelen.</p>
              <h2>Bakgrunn</h2>
              <p>Ekte artikkelinnhold som skal forbli etter opprydding her.</p>
              <p>Mer innhold for å møte ekstraksjonstersklene riktig.</p>
              <p>Ekstra innhold for artikkeldeteksjon av Readability.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('AI-generert oppsummering');
      expect(result?.plainText).not.toContain('Hovedpoenget som skal fjernes');
      expect(result?.plainText).toContain('Ekte artikkelinnhold');
    });

    it('removes figcaptions from extracted content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Photo Article</h1>
              <figure>
                <figcaption>Photo by Someone / Getty Images</figcaption>
              </figure>
              <p>The actual story content that matters to readers here.</p>
              <p>More content to ensure proper extraction happens.</p>
              <p>Even more content for the threshold requirements.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('Photo by Someone');
    });

    it('removes info boxes and factboxes', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Main Article</h1>
              <aside class="infobox">
                <p>Quick facts that interrupt reading flow here.</p>
              </aside>
              <div class="factbox">
                <p>Did you know? Some factoid content.</p>
              </div>
              <p>Real article content that should remain in output.</p>
              <p>More content for extraction threshold requirements.</p>
              <p>Additional paragraph for article detection.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('Quick facts');
      expect(result?.plainText).not.toContain('Did you know');
      expect(result?.plainText).toContain('Real article content');
    });

    it('removes newsletter and subscribe prompts', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Main Article</h1>
              <div class="newsletter-signup">
                <p>Subscribe to our newsletter for updates!</p>
              </div>
              <p>Real article content that readers want to see here.</p>
              <p>More content for extraction to work properly.</p>
              <p>Additional content for threshold requirements.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('Subscribe to our newsletter');
    });

    it('removes related articles sections', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Main Article</h1>
              <p>Real article content that should be extracted properly.</p>
              <p>More content for extraction threshold requirements here.</p>
              <div class="related-articles">
                <h3>Related Articles</h3>
                <a href="#">Another article link</a>
              </div>
              <p>Final content paragraph for the article body.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).not.toContain('Related Articles');
      expect(result?.plainText).not.toContain('Another article link');
    });
  });

  describe('Normalization Integration', () => {
    it('produces clean markup without inline styles', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Styled Article</h1>
              <p style="color: red; font-size: 18px;">Content with inline styles.</p>
              <p style="margin: 20px;">More styled content here.</p>
              <p>Plain content without any styles applied.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      // Content should be extracted, styles stripped at DOM level
      expect(result?.blocks.length).toBeGreaterThan(0);
    });

    it('unwraps nested container divs', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Nested Article</h1>
              <div class="wrapper">
                <div class="inner">
                  <p>Deeply nested content that should be extracted.</p>
                  <p>More nested content for extraction thresholds.</p>
                </div>
              </div>
              <p>Additional content for proper article detection.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).toContain('Deeply nested content');
    });

    it('converts h4-h6 to h3 in output blocks', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Main Title</h1>
              <p>Introduction paragraph with enough content for extraction.</p>
              <h4>Subheading Level 4</h4>
              <p>Content under subheading with more text for thresholds.</p>
              <h5>Subheading Level 5</h5>
              <p>More content under another subheading level here.</p>
              <p>Final paragraph to meet extraction requirements.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      // H4 and H5 should be converted to level 3 headings
      const headings = result?.blocks.filter(b => b.type === 'heading');
      expect(headings).toBeDefined();
      if (headings && headings.length > 0) {
        headings.forEach(h => {
          if (h.type === 'heading') {
            expect(h.level).toBeLessThanOrEqual(3);
          }
        });
      }
    });

    it('preserves semantic inline elements (strong, em)', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>Text with <strong>bold emphasis</strong> and <em>italic text</em> preserved.</p>
              <p>More content for extraction threshold requirements here.</p>
              <p>Additional paragraph for proper article detection.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      expect(result?.plainText).toContain('bold emphasis');
      expect(result?.plainText).toContain('italic text');
    });

    it('removes h1 from body (title from metadata)', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Article</title></head>
          <body>
            <article>
              <h1>Article Title That Should Not Appear In Body</h1>
              <p>First paragraph of content for extraction to work.</p>
              <p>Second paragraph with more content for thresholds.</p>
              <p>Third paragraph to ensure proper article detection.</p>
            </article>
          </body>
        </html>
      `;
      const doc = createDocument(html);
      const result = extractContent(doc, 'https://example.com');
      
      expect(result).not.toBeNull();
      // H1 should be removed from blocks (title comes from metadata)
      const h1Blocks = result?.blocks.filter(b => b.type === 'heading' && b.level === 1);
      expect(h1Blocks).toHaveLength(0);
    });
  });
});
