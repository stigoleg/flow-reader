/**
 * Search utilities for in-reader document search.
 * Provides functions to search for text within FlowDocument blocks
 * and check if specific words are part of search matches.
 */

import type { Block, FlowDocument } from '@/types';
import { tokenizeIntoWords } from './tokenizer';

/**
 * Represents a single search match in the document.
 */
export interface SearchMatch {
  /** Block index where the match was found */
  blockIndex: number;
  /** Starting word index within the block */
  startWordIndex: number;
  /** Ending word index within the block (inclusive) */
  endWordIndex: number;
  /** The matched text content */
  textContent: string;
  /** Chapter index for multi-chapter documents */
  chapterIndex?: number;
}

/**
 * Get the text content of a block for searching.
 */
function getBlockText(block: Block): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
    case 'code':
      return block.content;
    case 'list':
      return block.items.join(' ');
    default:
      return '';
  }
}

/**
 * Normalize text for case-insensitive comparison.
 * Removes accents and converts to lowercase.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Search within a single block for matches of the query.
 * Returns all matches found in the block.
 */
export function searchBlock(
  block: Block,
  query: string,
  blockIndex: number,
  chapterIndex?: number
): SearchMatch[] {
  if (!query.trim()) return [];
  
  const blockText = getBlockText(block);
  if (!blockText) return [];
  
  const words = tokenizeIntoWords(blockText);
  if (words.length === 0) return [];
  
  const normalizedQuery = normalizeText(query.trim());
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0) return [];
  
  const matches: SearchMatch[] = [];
  
  // Sliding window search for multi-word queries
  for (let i = 0; i <= words.length - queryWords.length; i++) {
    let isMatch = true;
    const matchWords: string[] = [];
    
    for (let j = 0; j < queryWords.length; j++) {
      const wordText = normalizeText(words[i + j].text);
      // Strip punctuation for comparison
      const cleanWordText = wordText.replace(/[^\p{L}\p{N}]/gu, '');
      const cleanQueryWord = queryWords[j].replace(/[^\p{L}\p{N}]/gu, '');
      
      // Check if word starts with or contains the query word
      if (!cleanWordText.includes(cleanQueryWord)) {
        isMatch = false;
        break;
      }
      matchWords.push(words[i + j].text);
    }
    
    if (isMatch) {
      matches.push({
        blockIndex,
        startWordIndex: i,
        endWordIndex: i + queryWords.length - 1,
        textContent: matchWords.join(' '),
        chapterIndex,
      });
    }
  }
  
  return matches;
}

/**
 * Search the entire document for matches of the query.
 * For multi-chapter books, searches ALL chapters.
 * Returns all matches sorted by position (chapter index, block index, then word index).
 */
export function searchDocument(
  document: FlowDocument,
  query: string,
  _currentChapterIndex?: number
): SearchMatch[] {
  if (!query.trim() || !document) return [];
  
  const allMatches: SearchMatch[] = [];
  
  // For books, search all chapters
  if (document.book && document.book.chapters.length > 0) {
    for (let chapterIdx = 0; chapterIdx < document.book.chapters.length; chapterIdx++) {
      const chapter = document.book.chapters[chapterIdx];
      for (let blockIdx = 0; blockIdx < chapter.blocks.length; blockIdx++) {
        const blockMatches = searchBlock(chapter.blocks[blockIdx], query, blockIdx, chapterIdx);
        allMatches.push(...blockMatches);
      }
    }
  } else {
    // Single-document: search blocks directly
    for (let i = 0; i < document.blocks.length; i++) {
      const blockMatches = searchBlock(document.blocks[i], query, i);
      allMatches.push(...blockMatches);
    }
  }
  
  return allMatches;
}

/**
 * Check if a word at a specific position is part of any search match.
 * Returns the match if found, null otherwise.
 */
export function getSearchMatchForWord(
  blockIndex: number,
  wordIndex: number,
  matches: SearchMatch[]
): SearchMatch | null {
  for (const match of matches) {
    if (
      match.blockIndex === blockIndex &&
      wordIndex >= match.startWordIndex &&
      wordIndex <= match.endWordIndex
    ) {
      return match;
    }
  }
  return null;
}

/**
 * Check if a word at a specific position is the start of a search match.
 * Used to identify the "current" match position.
 */
export function isMatchStart(
  blockIndex: number,
  wordIndex: number,
  match: SearchMatch
): boolean {
  return match.blockIndex === blockIndex && match.startWordIndex === wordIndex;
}

/**
 * Find the index of a match in the matches array based on block and word position.
 */
export function findMatchIndex(
  blockIndex: number,
  wordIndex: number,
  matches: SearchMatch[]
): number {
  return matches.findIndex(
    m => m.blockIndex === blockIndex && m.startWordIndex <= wordIndex && m.endWordIndex >= wordIndex
  );
}

/**
 * Get the next match index, wrapping around to the beginning if at the end.
 */
export function getNextMatchIndex(currentIndex: number, totalMatches: number): number {
  if (totalMatches === 0) return -1;
  return (currentIndex + 1) % totalMatches;
}

/**
 * Get the previous match index, wrapping around to the end if at the beginning.
 */
export function getPrevMatchIndex(currentIndex: number, totalMatches: number): number {
  if (totalMatches === 0) return -1;
  if (currentIndex <= 0) return totalMatches - 1;
  return currentIndex - 1;
}
