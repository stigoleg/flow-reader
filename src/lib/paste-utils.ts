/**
 * Paste extraction utilities for the popup.
 * 
 * This module handles paste-to-document conversion with markdown support.
 * It uses the 'marked' library for markdown parsing, which is lightweight (~35KB).
 * 
 * IMPORTANT: This module must NOT import from other src/ modules that may have
 * heavy transitive dependencies. All utilities are inlined here.
 */

import { marked, type Token } from 'marked';
import type { Block, FlowDocument, HeadingBlock, ParagraphBlock, ListBlock, QuoteBlock, CodeBlock } from '@/types';

/** Type alias for marked tokens */
type MarkedToken = Token;

/**
 * Compute a hash from a text string for stable identification.
 * Uses a simple but effective hash algorithm (djb2 variant).
 * Returns a 16-character hex string.
 * 
 * NOTE: This is a copy of computeTextHash from file-utils.ts to avoid
 * importing that module which may bring in transitive dependencies.
 */
function computeTextHash(text: string): string {
  let hash1 = 5381;
  let hash2 = 52711;
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  
  const combined = (Math.abs(hash1) * 4096 + Math.abs(hash2)).toString(16);
  return combined.padStart(16, '0').slice(0, 16);
}

/**
 * Convert plain text into paragraph blocks.
 * Splits on double newlines to create paragraphs.
 */
function textToParagraphBlocks(text: string): Block[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map((content, index) => ({
      type: 'paragraph' as const,
      content,
      id: `block-${index}`,
    }));
}

/**
 * Get plain text from an array of blocks.
 */
function getPlainText(blocks: Block[]): string {
  return blocks.map(block => 
    block.type === 'list' ? block.items.join(' ') : block.content
  ).join(' ');
}

/**
 * Detect if text contains markdown formatting.
 * Checks for common markdown patterns that wouldn't appear in plain text.
 */
function detectMarkdown(text: string): boolean {
  // Patterns that strongly indicate markdown
  const markdownPatterns = [
    /^#{1,6}\s+.+$/m,           // Headers: # Header
    /^\s*[-*+]\s+.+$/m,         // Unordered lists: - item, * item, + item
    /^\s*\d+\.\s+.+$/m,         // Ordered lists: 1. item
    /\[.+?\]\(.+?\)/,           // Links: [text](url)
    /```[\s\S]*?```/,           // Fenced code blocks
    /`[^`]+`/,                  // Inline code
    /^\s*>\s+.+$/m,             // Blockquotes: > quote
    /\*\*[^*]+\*\*/,            // Bold: **text**
    /\*[^*]+\*/,                // Italic: *text*
    /__[^_]+__/,                // Bold: __text__
    /_[^_]+_/,                  // Italic: _text_
    /^\s*[-*_]{3,}\s*$/m,       // Horizontal rules: --- or *** or ___
  ];
  
  // Count how many markdown patterns are found
  let patternCount = 0;
  for (const pattern of markdownPatterns) {
    if (pattern.test(text)) {
      patternCount++;
      // If we find 2+ patterns, it's likely markdown
      if (patternCount >= 2) return true;
    }
  }
  
  // Single pattern might be coincidental (e.g., "- " in regular text)
  // Only treat as markdown if we find headers or code blocks (strong indicators)
  if (/^#{1,6}\s+.+$/m.test(text)) return true;
  if (/```[\s\S]*?```/.test(text)) return true;
  
  return false;
}

/**
 * Strip inline markdown formatting from text.
 * Converts **bold**, *italic*, `code`, [links](url), etc. to plain text.
 */
function stripInlineMarkdown(text: string): string {
  return text
    // Remove bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic: *text* or _text_
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '$1')
    // Remove inline code: `code`
    .replace(/`(.+?)`/g, '$1')
    // Convert links: [text](url) -> text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Convert images: ![alt](url) -> alt
    .replace(/!\[(.+?)\]\(.+?\)/g, '$1')
    // Clean up any remaining markdown artifacts
    .trim();
}

/**
 * Extract plain text from nested marked tokens.
 */
function extractTextFromTokens(tokens: MarkedToken[]): string {
  const parts: string[] = [];
  
  for (const token of tokens) {
    if ('text' in token && typeof token.text === 'string') {
      parts.push(stripInlineMarkdown(token.text));
    } else if ('tokens' in token && Array.isArray(token.tokens)) {
      parts.push(extractTextFromTokens(token.tokens as MarkedToken[]));
    }
  }
  
  return parts.join(' ').trim();
}

/**
 * Parse markdown text into FlowReader blocks.
 * Uses the marked library for parsing, then converts tokens to blocks.
 */
function parseMarkdownToBlocks(text: string): { blocks: Block[]; title: string | null } {
  const tokens = marked.lexer(text);
  
  const blocks: Block[] = [];
  let blockIndex = 0;
  let title: string | null = null;
  
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const headingBlock: HeadingBlock = {
          type: 'heading',
          level: token.depth as 1 | 2 | 3 | 4 | 5 | 6,
          content: stripInlineMarkdown(token.text),
          id: `block-${blockIndex++}`,
        };
        blocks.push(headingBlock);
        // Use first h1 as document title
        if (token.depth === 1 && !title) {
          title = stripInlineMarkdown(token.text);
        }
        break;
      }
      
      case 'paragraph': {
        const paragraphBlock: ParagraphBlock = {
          type: 'paragraph',
          content: stripInlineMarkdown(token.text),
          id: `block-${blockIndex++}`,
        };
        blocks.push(paragraphBlock);
        break;
      }
      
      case 'list': {
        const items = token.items.map((item: { text: string }) => stripInlineMarkdown(item.text));
        const listBlock: ListBlock = {
          type: 'list',
          ordered: token.ordered,
          items,
          id: `block-${blockIndex++}`,
        };
        blocks.push(listBlock);
        break;
      }
      
      case 'blockquote': {
        // Blockquote may contain nested tokens - extract text
        const quoteText = extractTextFromTokens(token.tokens || []);
        const quoteBlock: QuoteBlock = {
          type: 'quote',
          content: quoteText,
          id: `block-${blockIndex++}`,
        };
        blocks.push(quoteBlock);
        break;
      }
      
      case 'code': {
        const codeBlock: CodeBlock = {
          type: 'code',
          content: token.text,
          language: token.lang || undefined,
          id: `block-${blockIndex++}`,
        };
        blocks.push(codeBlock);
        break;
      }
      
      case 'hr':
        // Skip horizontal rules - they're visual separators
        break;
        
      case 'space':
        // Skip empty space
        break;
        
      default:
        // For any unhandled token types, try to extract text content
        if ('text' in token && typeof token.text === 'string' && token.text.trim()) {
          const fallbackBlock: ParagraphBlock = {
            type: 'paragraph',
            content: stripInlineMarkdown(token.text),
            id: `block-${blockIndex++}`,
          };
          blocks.push(fallbackBlock);
        }
    }
  }
  
  return { blocks, title };
}

/**
 * Extract a FlowDocument from pasted text.
 * 
 * Supports both plain text and markdown formatting.
 * Stores the original text in pasteContent for later editing.
 */
export function extractFromPaste(text: string): FlowDocument {
  // Check if text looks like markdown
  const looksLikeMarkdown = detectMarkdown(text);
  
  let blocks: Block[];
  let title = 'Pasted Text';
  
  if (looksLikeMarkdown) {
    const result = parseMarkdownToBlocks(text);
    blocks = result.blocks;
    title = result.title || title;
  } else {
    blocks = textToParagraphBlocks(text);
  }
  
  const textHash = computeTextHash(text);

  return {
    metadata: {
      title,
      source: 'paste',
      createdAt: Date.now(),
      fileHash: textHash,
      // Store original paste content for editing
      pasteContent: text,
    },
    blocks,
    plainText: getPlainText(blocks),
  };
}
