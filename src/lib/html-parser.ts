import type { Block } from '@/types';

export interface ParseHtmlOptions {
  handleTables?: boolean;
}

export function parseHtmlToBlocks(html: string, options: ParseHtmlOptions = {}): Block[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  let blockId = 0;

  const generateId = (): string => `block-${blockId++}`;

  function processNode(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6;
      const content = element.textContent?.trim() || '';
      if (content) {
        blocks.push({ type: 'heading', level, content, id: generateId() });
      }
      return;
    }

    if (tagName === 'p') {
      const content = element.textContent?.trim() || '';
      if (content) {
        blocks.push({ type: 'paragraph', content, id: generateId() });
      }
      return;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const items: string[] = [];
      element.querySelectorAll('li').forEach((li) => {
        const text = li.textContent?.trim();
        if (text) items.push(text);
      });
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tagName === 'ol', items, id: generateId() });
      }
      return;
    }

    if (tagName === 'blockquote') {
      const content = element.textContent?.trim() || '';
      if (content) {
        blocks.push({ type: 'quote', content, id: generateId() });
      }
      return;
    }

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

    if (tagName === 'pre') {
      const codeElement = element.querySelector('code');
      const content = (codeElement || element).textContent?.trim() || '';
      const language = codeElement?.className.match(/language-(\w+)/)?.[1];
      if (content) {
        blocks.push({ type: 'code', content, language, id: generateId() });
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      processNode(child);
    }
  }

  for (const child of Array.from(doc.body.childNodes)) {
    processNode(child);
  }

  return blocks;
}
