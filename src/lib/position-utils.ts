import type { Block } from '@/types';
import { getBlockText } from './block-utils';
import { getWordCount } from './tokenizer';

/**
 * Position conversion utilities for synchronizing reading position
 * between pacing mode (block-relative) and RSVP mode (global token index).
 */

/**
 * Convert pacing position (block index + word index within block) to cumulative word count.
 * This represents how many words have been read from the start of the document.
 */
export function pacingToWordCount(
  blocks: Block[],
  blockIndex: number,
  wordIndex: number
): number {
  let wordCount = 0;

  // Sum words in all blocks before the current block
  for (let i = 0; i < blockIndex && i < blocks.length; i++) {
    const text = getBlockText(blocks[i]);
    wordCount += getWordCount(text);
  }

  // Add the word index within the current block
  wordCount += wordIndex;

  return wordCount;
}

/**
 * Convert cumulative word count to RSVP token index.
 * RSVP tokens can contain multiple words based on chunkSize.
 */
export function wordCountToRsvpIndex(
  wordCount: number,
  chunkSize: number = 1
): number {
  if (chunkSize <= 0) return 0;
  return Math.floor(wordCount / chunkSize);
}

/**
 * Convert RSVP token index to approximate cumulative word count.
 * Returns the word count at the START of the given token.
 */
export function rsvpIndexToWordCount(
  rsvpIndex: number,
  chunkSize: number = 1
): number {
  if (chunkSize <= 0) return 0;
  return rsvpIndex * chunkSize;
}

/**
 * Convert cumulative word count to pacing position (block index + word index).
 * Walks through blocks to find which block contains the target word.
 */
export function wordCountToPacing(
  blocks: Block[],
  targetWordCount: number
): { blockIndex: number; wordIndex: number } {
  if (blocks.length === 0) {
    return { blockIndex: 0, wordIndex: 0 };
  }

  let cumulativeWords = 0;

  for (let i = 0; i < blocks.length; i++) {
    const text = getBlockText(blocks[i]);
    const blockWordCount = getWordCount(text);

    // Check if target word is within this block
    if (cumulativeWords + blockWordCount > targetWordCount) {
      return {
        blockIndex: i,
        wordIndex: targetWordCount - cumulativeWords,
      };
    }

    cumulativeWords += blockWordCount;
  }

  // Target is at or beyond the end - return last block, last word
  const lastBlock = blocks[blocks.length - 1];
  const lastBlockWordCount = getWordCount(getBlockText(lastBlock));
  return {
    blockIndex: blocks.length - 1,
    wordIndex: Math.max(0, lastBlockWordCount - 1),
  };
}

/**
 * Calculate total word count across all blocks.
 */
export function getTotalWordCount(blocks: Block[]): number {
  return blocks.reduce((sum, block) => sum + getWordCount(getBlockText(block)), 0);
}
