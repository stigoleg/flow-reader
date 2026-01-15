import { describe, it, expect, beforeEach } from 'vitest';
import { 
  cleanArticleDocument, 
  setCleanupDebug,
  getCleanupLogs,
  MIN_TEXT_CHARS, 
  MAX_LINK_DENSITY,
  SUMMARY_HEADING_PATTERNS,
  BOILERPLATE_PATTERNS,
} from '@/lib/article-cleanup';

// Helper to create a DOM element from HTML string
function createDOM(html: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body;
}

describe('Article Cleanup', () => {
  beforeEach(() => {
    setCleanupDebug(false);
  });

  describe('Constants', () => {
    it('exports configurable thresholds', () => {
      expect(MIN_TEXT_CHARS).toBe(80);
      expect(MAX_LINK_DENSITY).toBe(0.5);
    });

    it('has summary heading patterns for English', () => {
      const englishPatterns = [
        'Summary', 'AI Summary', 'Key Takeaways', 'Key Points',
        'Highlights', 'In Brief', 'TL;DR', 'TLDR',
      ];
      for (const text of englishPatterns) {
        const matches = SUMMARY_HEADING_PATTERNS.some(p => p.test(text));
        expect(matches).toBe(true);
      }
    });

    it('has summary heading patterns for Norwegian', () => {
      const norwegianPatterns = [
        'Oppsummering', 'AI Oppsummering', 'Kort fortalt',
        'Hovedpoenger', 'Nøkkelpunkter', 'Sammendrag',
      ];
      for (const text of norwegianPatterns) {
        const matches = SUMMARY_HEADING_PATTERNS.some(p => p.test(text));
        expect(matches).toBe(true);
      }
    });

    it('has boilerplate patterns', () => {
      const boilerplateTexts = [
        'Read more about this', 'Les mer om dette',
        'Related articles', 'Relaterte artikler',
        'Advertisement', 'Annonse',
        'Sponsored content', 'Sponset innhold',
      ];
      for (const text of boilerplateTexts) {
        const matches = BOILERPLATE_PATTERNS.some(p => p.test(text));
        expect(matches).toBe(true);
      }
    });
  });

  describe('Summary Box Removal', () => {
    it('removes AI summary sections by class', () => {
      const root = createDOM(`
        <div class="ai-summary"><p>Summary text here.</p></div>
        <p>Real article content that should remain in the output.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('.ai-summary')).toBeNull();
      expect(root.textContent).toContain('Real article content');
    });

    it('removes summary box by class pattern', () => {
      const root = createDOM(`
        <div class="article-summary-box"><p>Quick summary.</p></div>
        <p>Main article content that readers want to see.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="summary"]')).toBeNull();
      expect(root.textContent).toContain('Main article');
    });

    it('removes tldr sections', () => {
      const root = createDOM(`
        <div class="tldr"><p>Too long didn't read version.</p></div>
        <p>The full article content starts here with details.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('.tldr')).toBeNull();
      expect(root.textContent).toContain('full article');
    });

    it('removes summary sections by heading (English)', () => {
      const root = createDOM(`
        <h2>Key Takeaways</h2>
        <ul><li>Point 1</li><li>Point 2</li></ul>
        <h2>Main Content</h2>
        <p>Article body text that should remain here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Key Takeaways');
      expect(root.textContent).not.toContain('Point 1');
      expect(root.textContent).toContain('Main Content');
      expect(root.textContent).toContain('Article body');
    });

    it('removes summary sections by heading (Norwegian)', () => {
      const root = createDOM(`
        <h2>Oppsummering</h2>
        <p>AI-oppsummering her som skal fjernes.</p>
        <h2>Bakgrunn</h2>
        <p>Ekte innhold som skal forbli.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Oppsummering');
      expect(root.textContent).not.toContain('AI-oppsummering');
      expect(root.textContent).toContain('Bakgrunn');
      expect(root.textContent).toContain('Ekte innhold');
    });

    it('removes kort fortalt sections', () => {
      const root = createDOM(`
        <h3>Kort fortalt</h3>
        <p>Kort versjon her.</p>
        <h3>Historien</h3>
        <p>Den fulle historien starter her.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Kort fortalt');
      expect(root.textContent).toContain('Historien');
    });

    it('stops section removal at next heading of same level', () => {
      const root = createDOM(`
        <h2>Summary</h2>
        <p>Summary content to remove.</p>
        <p>More summary content.</p>
        <h2>Real Section</h2>
        <p>This should remain.</p>
        <h3>Subsection</h3>
        <p>This should also remain.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Summary content');
      expect(root.textContent).toContain('Real Section');
      expect(root.textContent).toContain('Subsection');
    });
  });

  describe('Info Box Removal', () => {
    it('removes aside elements', () => {
      const root = createDOM(`
        <aside><p>Sidebar content that interrupts flow.</p></aside>
        <p>Main article content here that readers want.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('aside')).toBeNull();
      expect(root.textContent).toContain('Main article');
    });

    it('removes infobox by class', () => {
      const root = createDOM(`
        <div class="infobox"><p>Info box content.</p></div>
        <p>Article content remains here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('.infobox')).toBeNull();
    });

    it('removes factbox by class', () => {
      const root = createDOM(`
        <div class="factbox"><p>Fact here.</p></div>
        <p>Article content remains here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('.factbox')).toBeNull();
    });

    it('removes info-box with hyphen', () => {
      const root = createDOM(`
        <div class="info-box"><p>Info content.</p></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('.info-box')).toBeNull();
    });
  });

  describe('Caption Removal', () => {
    it('removes figcaption elements', () => {
      const root = createDOM(`
        <figcaption>Photo credit: Someone / Agency</figcaption>
        <p>Article content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('figcaption')).toBeNull();
    });

    it('removes figure elements', () => {
      const root = createDOM(`
        <figure><img src="photo.jpg"><figcaption>Caption</figcaption></figure>
        <p>Article content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('figure')).toBeNull();
    });

    it('removes elements with caption class', () => {
      const root = createDOM(`
        <p class="image-caption">Image description here.</p>
        <p>Real content here that should stay.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('.image-caption')).toBeNull();
    });

    it('removes elements with credit class', () => {
      const root = createDOM(`
        <span class="photo-credit">Photo: Reuters</span>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="credit"]')).toBeNull();
    });
  });

  describe('Media Element Removal', () => {
    it('removes video elements', () => {
      const root = createDOM(`
        <video src="video.mp4"></video>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('video')).toBeNull();
    });

    it('removes audio elements', () => {
      const root = createDOM(`
        <audio src="audio.mp3"></audio>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('audio')).toBeNull();
    });

    it('removes picture elements', () => {
      const root = createDOM(`
        <picture><source srcset="img.webp"><img src="img.jpg"></picture>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('picture')).toBeNull();
    });

    it('removes gallery containers', () => {
      const root = createDOM(`
        <div class="photo-gallery"><img src="1.jpg"><img src="2.jpg"></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="gallery"]')).toBeNull();
    });
  });

  describe('Promotional Content Removal', () => {
    it('removes newsletter signup', () => {
      const root = createDOM(`
        <div class="newsletter-signup"><p>Subscribe to our newsletter!</p></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="newsletter"]')).toBeNull();
    });

    it('removes subscribe prompts', () => {
      const root = createDOM(`
        <div class="subscribe-box"><button>Subscribe Now</button></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="subscribe"]')).toBeNull();
    });

    it('removes related articles', () => {
      const root = createDOM(`
        <div class="related-articles"><a href="#">Related 1</a></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="related"]')).toBeNull();
    });

    it('removes recommended content', () => {
      const root = createDOM(`
        <div class="recommended-posts"><a href="#">Recommended</a></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="recommended"]')).toBeNull();
    });

    it('removes share buttons', () => {
      const root = createDOM(`
        <div class="share-buttons"><button>Share</button></div>
        <p>Article content.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[class*="share"]')).toBeNull();
    });
  });

  describe('Structural Element Removal', () => {
    it('removes nav elements', () => {
      const root = createDOM(`
        <nav><a href="/">Home</a></nav>
        <p>Content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('nav')).toBeNull();
    });

    it('removes header elements', () => {
      const root = createDOM(`
        <header><h1>Site Title</h1></header>
        <p>Content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('header')).toBeNull();
    });

    it('removes footer elements', () => {
      const root = createDOM(`
        <p>Content here.</p>
        <footer>Copyright 2024</footer>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('footer')).toBeNull();
    });

    it('removes form elements', () => {
      const root = createDOM(`
        <form><input type="text"><button>Submit</button></form>
        <p>Content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('form')).toBeNull();
    });

    it('removes elements with navigation role', () => {
      const root = createDOM(`
        <div role="navigation"><a href="/">Nav</a></div>
        <p>Content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[role="navigation"]')).toBeNull();
    });

    it('removes elements with complementary role', () => {
      const root = createDOM(`
        <div role="complementary"><p>Sidebar</p></div>
        <p>Content here.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[role="complementary"]')).toBeNull();
    });
  });

  describe('Heuristic Removal', () => {
    it('removes low text density blocks (< 80 chars)', () => {
      const root = createDOM(`
        <p>Too short</p>
        <p>This paragraph has enough content to pass the minimum threshold for text density.</p>
      `);
      cleanArticleDocument(root);
      const paragraphs = root.querySelectorAll('p');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].textContent).toContain('enough content');
    });

    it('keeps headings even if short', () => {
      const root = createDOM(`
        <h2>Short</h2>
        <p>This paragraph has enough content to pass the minimum threshold for extraction.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('h2')).not.toBeNull();
    });

    it('removes high link density blocks (> 50% link text)', () => {
      const root = createDOM(`
        <p><a href="#">Link 1</a> <a href="#">Link 2</a> <a href="#">Link 3</a></p>
        <p>Normal paragraph with some <a href="#">link</a> text mixed in with regular content.</p>
      `);
      cleanArticleDocument(root);
      // First p is all links, second has mostly text
      expect(root.querySelectorAll('p').length).toBe(1);
    });

    it('removes boilerplate starting patterns', () => {
      const root = createDOM(`
        <p>Read more about this topic in our other articles and posts.</p>
        <p>Actual article content that should stay here and be read.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Read more');
      expect(root.textContent).toContain('Actual article');
    });

    it('removes Norwegian boilerplate patterns', () => {
      const root = createDOM(`
        <p>Les mer om dette temaet i våre andre artikler.</p>
        <p>Faktisk artikkelinnhold som skal forbli her for leseren.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Les mer');
      expect(root.textContent).toContain('Faktisk artikkelinnhold');
    });

    it('removes elements with summary aria-label', () => {
      const root = createDOM(`
        <div aria-label="Article summary"><p>Summary text.</p></div>
        <p>Real content here that should be preserved for reading.</p>
      `);
      cleanArticleDocument(root);
      expect(root.querySelector('[aria-label*="summary"]')).toBeNull();
    });

    it('removes elements with related data attributes', () => {
      const root = createDOM(`
        <div data-section="related"><p>Related content.</p></div>
        <p>Real content here that should be preserved for reading.</p>
      `);
      cleanArticleDocument(root);
      expect(root.textContent).not.toContain('Related content');
    });
  });

  describe('Debug Mode', () => {
    it('logs removals when debug is enabled', () => {
      setCleanupDebug(true);
      const root = createDOM(`
        <aside><p>Sidebar</p></aside>
        <p>Content here that is long enough to pass the filter thresholds.</p>
      `);
      cleanArticleDocument(root);
      const logs = getCleanupLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.reason === 'structural')).toBe(true);
    });

    it('clears logs when debug is disabled', () => {
      setCleanupDebug(true);
      const root = createDOM(`<aside>Test</aside>`);
      cleanArticleDocument(root);
      expect(getCleanupLogs().length).toBeGreaterThan(0);
      
      setCleanupDebug(false);
      expect(getCleanupLogs()).toHaveLength(0);
    });
  });
});
