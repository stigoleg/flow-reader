import type { Block } from '@/types';

export interface ParseHtmlOptions {
  handleTables?: boolean;
  /** Preserve inline formatting as HTML in content */
  preserveFormatting?: boolean;
}

/**
 * Parse HTML content into FlowReader blocks.
 * 
 * This parser is designed to handle both web articles and ebook content.
 * It recursively traverses the DOM, collecting block-level elements and
 * their text content while preserving semantic structure.
 */
export function parseHtmlToBlocks(html: string, options: ParseHtmlOptions = {}): Block[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  let blockId = 0;

  const generateId = (): string => `block-${blockId++}`;

  /**
   * Get text content, optionally preserving inline formatting
   */
  function getContent(element: Element): string {
    if (options.preserveFormatting) {
      // Preserve inline formatting tags
      return getFormattedContent(element);
    }
    return element.textContent?.trim() || '';
  }

  /**
   * Get content with inline formatting preserved as HTML
   */
  function getFormattedContent(element: Element): string {
    // Clone to avoid modifying original
    const clone = element.cloneNode(true) as Element;
    
    // Remove any remaining block elements from inline content
    clone.querySelectorAll('div, p, br, hr').forEach(el => {
      // Replace with space to preserve word boundaries
      const space = document.createTextNode(' ');
      el.replaceWith(space);
    });
    
    // Get inner HTML and normalize whitespace
    return clone.innerHTML
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if an element is a block-level element we should process
   */
  function isBlockElement(tagName: string): boolean {
    return /^(h[1-6]|p|ul|ol|blockquote|pre|div|section|article|aside|header|footer|main|figure|figcaption|address|details|summary)$/.test(tagName);
  }

  /**
   * Check if element only contains inline content (no nested blocks)
   */
  function hasOnlyInlineContent(element: Element): boolean {
    for (const child of Array.from(element.children)) {
      if (isBlockElement(child.tagName.toLowerCase())) {
        return false;
      }
    }
    return true;
  }

  /**
   * Process a single element and its descendants
   */
  function processElement(element: Element): void {
    const tagName = element.tagName.toLowerCase();

    // Headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6;
      const content = getContent(element);
      if (content) {
        blocks.push({ type: 'heading', level, content, id: generateId() });
      }
      return;
    }

    // Paragraphs
    if (tagName === 'p') {
      const content = getContent(element);
      if (content) {
        blocks.push({ type: 'paragraph', content, id: generateId() });
      }
      return;
    }

    // Lists
    if (tagName === 'ul' || tagName === 'ol') {
      const items: string[] = [];
      // Only get direct li children to avoid nested list issues
      for (const child of Array.from(element.children)) {
        if (child.tagName.toLowerCase() === 'li') {
          const text = getContent(child);
          if (text) items.push(text);
        }
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tagName === 'ol', items, id: generateId() });
      }
      return;
    }

    // Blockquotes
    if (tagName === 'blockquote') {
      const content = getContent(element);
      if (content) {
        blocks.push({ type: 'quote', content, id: generateId() });
      }
      return;
    }

    // Code blocks
    if (tagName === 'pre') {
      const codeElement = element.querySelector('code');
      const content = (codeElement || element).textContent?.trim() || '';
      const language = codeElement?.className.match(/language-(\w+)/)?.[1];
      if (content) {
        blocks.push({ type: 'code', content, language, id: generateId() });
      }
      return;
    }

    // Tables
    if (options.handleTables && tagName === 'table') {
      element.querySelectorAll('tr').forEach((row) => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length > 0) {
          const rowText = Array.from(cells)
            .map((cell) => cell.textContent?.trim())
            .filter(Boolean)
            .join(' | ');
          if (rowText) {
            blocks.push({ type: 'paragraph', content: rowText, id: generateId() });
          }
        }
      });
      return;
    }

    // Container elements (div, section, article, etc.)
    // Check if it contains only inline content - treat as paragraph
    if (isBlockElement(tagName) && hasOnlyInlineContent(element)) {
      const content = getContent(element);
      if (content) {
        blocks.push({ type: 'paragraph', content, id: generateId() });
      }
      return;
    }

    // For containers with nested blocks, recurse into children
    for (const child of Array.from(element.children)) {
      processElement(child);
    }

    // Also handle any direct text nodes that might be significant
    // (text not wrapped in any element)
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text && text.length > 20) {
          // Only create paragraph for substantial text
          blocks.push({ type: 'paragraph', content: text, id: generateId() });
        }
      }
    }
  }

  // Start processing from body
  processElement(doc.body);

  // If no blocks were extracted, try a more aggressive approach
  if (blocks.length === 0) {
    const allText = doc.body.textContent?.trim();
    if (allText) {
      // Split by double newlines or significant whitespace
      const paragraphs = allText.split(/\n\s*\n/).filter(p => p.trim());
      for (const para of paragraphs) {
        const content = para.trim();
        if (content) {
          blocks.push({ type: 'paragraph', content, id: generateId() });
        }
      }
    }
  }

  return blocks;
}

/**
 * Parse HTML specifically for ebook content.
 * More permissive than article parsing - preserves all text content.
 */
export function parseEbookHtml(html: string): Block[] {
  const parser = new DOMParser();
  
  // Try XHTML first (ebooks often use this)
  let doc = parser.parseFromString(html, 'application/xhtml+xml');
  const parseError = doc.querySelector('parsererror');
  
  if (parseError) {
    // Fall back to HTML parsing
    doc = parser.parseFromString(html, 'text/html');
  }
  
  const body = doc.querySelector('body') || doc.documentElement;
  const blocks: Block[] = [];
  let blockId = 0;

  const generateId = (): string => `block-${blockId++}`;

  /**
   * Extract clean text from an element, preserving word boundaries
   */
  function extractText(element: Element): string {
    // Clone to avoid modifying original
    const clone = element.cloneNode(true) as Element;
    
    // Remove script/style
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Replace br with newline
    clone.querySelectorAll('br').forEach(el => {
      el.replaceWith(document.createTextNode('\n'));
    });
    
    return (clone.textContent || '').trim();
  }

  /**
   * Check if element should be treated as a block
   */
  function isBlock(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    return /^(h[1-6]|p|div|section|article|blockquote|pre|ul|ol|li|figure|figcaption|header|footer|aside|main|address|details|summary)$/.test(tag);
  }

  /**
   * Process a block element
   */
  function processBlock(element: Element): void {
    const tagName = element.tagName.toLowerCase();
    
    // Skip empty elements
    const text = extractText(element);
    if (!text) return;

    // Headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: 'heading', level, content: text, id: generateId() });
      return;
    }

    // Lists - handle specially to preserve structure
    if (tagName === 'ul' || tagName === 'ol') {
      const items: string[] = [];
      element.querySelectorAll(':scope > li').forEach(li => {
        const itemText = extractText(li);
        if (itemText) items.push(itemText);
      });
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tagName === 'ol', items, id: generateId() });
      }
      return;
    }

    // Blockquotes
    if (tagName === 'blockquote') {
      blocks.push({ type: 'quote', content: text, id: generateId() });
      return;
    }

    // Code blocks
    if (tagName === 'pre') {
      const codeEl = element.querySelector('code');
      const lang = codeEl?.className.match(/language-(\w+)/)?.[1];
      blocks.push({ type: 'code', content: text, language: lang, id: generateId() });
      return;
    }

    // Paragraph or div with no block children - treat as paragraph
    const hasBlockChildren = Array.from(element.children).some(child => isBlock(child));
    
    if (!hasBlockChildren) {
      // This is a leaf block - add as paragraph
      blocks.push({ type: 'paragraph', content: text, id: generateId() });
    } else {
      // Has block children - recurse
      for (const child of Array.from(element.children)) {
        if (isBlock(child)) {
          processBlock(child);
        }
      }
    }
  }

  // Process all top-level block elements
  for (const child of Array.from(body.children)) {
    if (isBlock(child)) {
      processBlock(child);
    }
  }

  // Fallback: if nothing extracted, get all text as paragraphs
  if (blocks.length === 0) {
    const fullText = extractText(body);
    if (fullText) {
      // Split by paragraph-like boundaries
      const paras = fullText.split(/\n\s*\n/).filter(p => p.trim());
      for (const para of paras) {
        blocks.push({ type: 'paragraph', content: para.trim(), id: generateId() });
      }
    }
  }
  
  // If we ended up with one very long paragraph, split it for readability
  if (blocks.length === 1) {
    const firstBlock = blocks[0];
    if (firstBlock.type === 'paragraph' && firstBlock.content.length > 1000) {
      const content = firstBlock.content;
      blocks.length = 0;
      // Split on sentence boundaries (period followed by space and capital)
      const sentences = content.split(/(?<=[.!?])\s+(?=[A-Z])/);
      let currentPara = '';
      for (const sentence of sentences) {
        currentPara += sentence + ' ';
        // Create paragraph every ~500 chars or at natural break
        if (currentPara.length > 500) {
          blocks.push({ type: 'paragraph', content: currentPara.trim(), id: generateId() });
          currentPara = '';
        }
      }
      if (currentPara.trim()) {
        blocks.push({ type: 'paragraph', content: currentPara.trim(), id: generateId() });
      }
    }
  }

  return blocks;
}
