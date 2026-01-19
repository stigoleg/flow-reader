/**
 * Lightweight paste extraction utilities for the popup.
 * 
 * This module is intentionally minimal to avoid pulling in heavy dependencies
 * like Readability, html-parser, etc. The popup only needs basic paste-to-document
 * conversion.
 * 
 * IMPORTANT: This module must NOT import from other src/ modules that may have
 * heavy transitive dependencies. All utilities are inlined here.
 */

import type { Block, FlowDocument } from '@/types';

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
 * Extract a FlowDocument from pasted text.
 * 
 * This is a lightweight version that doesn't apply UI text filtering,
 * since pasted content is intentional and shouldn't be filtered.
 */
export function extractFromPaste(text: string): FlowDocument {
  const blocks = textToParagraphBlocks(text);
  const textHash = computeTextHash(text);

  return {
    metadata: {
      title: 'Pasted Text',
      source: 'paste',
      createdAt: Date.now(),
      fileHash: textHash,
    },
    blocks,
    plainText: getPlainText(blocks),
  };
}
