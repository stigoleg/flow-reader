import { describe, it, expect } from 'vitest';
import {
  pacingToWordCount,
  wordCountToRsvpIndex,
  rsvpIndexToWordCount,
  wordCountToPacing,
  getTotalWordCount,
} from '@/lib/position-utils';
import type { Block } from '@/types';

describe('Position Utils', () => {
  // Helper to create test blocks
  const createParagraph = (content: string): Block => ({
    type: 'paragraph',
    content,
  });

  const createList = (items: string[]): Block => ({
    type: 'list',
    ordered: false,
    items,
  });

  describe('pacingToWordCount', () => {
    it('returns 0 for position at start of first block', () => {
      const blocks = [
        createParagraph('First block with five words.'),
        createParagraph('Second block here.'),
      ];
      expect(pacingToWordCount(blocks, 0, 0)).toBe(0);
    });

    it('returns word index for position within first block', () => {
      const blocks = [
        createParagraph('First block with five words.'),
        createParagraph('Second block here.'),
      ];
      expect(pacingToWordCount(blocks, 0, 3)).toBe(3);
    });

    it('sums words from previous blocks', () => {
      const blocks = [
        createParagraph('One two three'),        // 3 words
        createParagraph('Four five six seven'),  // 4 words
        createParagraph('Eight nine'),           // 2 words
      ];
      // Position at block 1, word 2 = 3 + 2 = 5
      expect(pacingToWordCount(blocks, 1, 2)).toBe(5);
      // Position at block 2, word 0 = 3 + 4 = 7
      expect(pacingToWordCount(blocks, 2, 0)).toBe(7);
    });

    it('handles list blocks correctly', () => {
      const blocks = [
        createParagraph('One two'),           // 2 words
        createList(['Item one', 'Item two']), // 4 words (joined with space)
        createParagraph('Final word'),        // 2 words
      ];
      // Position at block 2, word 1 = 2 + 4 + 1 = 7
      expect(pacingToWordCount(blocks, 2, 1)).toBe(7);
    });

    it('handles empty blocks array', () => {
      expect(pacingToWordCount([], 0, 0)).toBe(0);
    });

    it('handles block index beyond array length', () => {
      const blocks = [createParagraph('One two three')];
      // Block index 5 is beyond length, so we sum all blocks (3 words) + wordIndex
      expect(pacingToWordCount(blocks, 5, 2)).toBe(5);
    });
  });

  describe('wordCountToRsvpIndex', () => {
    it('returns same value for chunk size 1', () => {
      expect(wordCountToRsvpIndex(0, 1)).toBe(0);
      expect(wordCountToRsvpIndex(5, 1)).toBe(5);
      expect(wordCountToRsvpIndex(100, 1)).toBe(100);
    });

    it('divides by chunk size and floors', () => {
      expect(wordCountToRsvpIndex(10, 2)).toBe(5);
      expect(wordCountToRsvpIndex(11, 2)).toBe(5);
      expect(wordCountToRsvpIndex(12, 2)).toBe(6);
    });

    it('handles chunk size 3', () => {
      expect(wordCountToRsvpIndex(0, 3)).toBe(0);
      expect(wordCountToRsvpIndex(1, 3)).toBe(0);
      expect(wordCountToRsvpIndex(2, 3)).toBe(0);
      expect(wordCountToRsvpIndex(3, 3)).toBe(1);
      expect(wordCountToRsvpIndex(8, 3)).toBe(2);
    });

    it('handles edge case of chunk size 0', () => {
      expect(wordCountToRsvpIndex(10, 0)).toBe(0);
    });

    it('handles negative chunk size', () => {
      expect(wordCountToRsvpIndex(10, -1)).toBe(0);
    });
  });

  describe('rsvpIndexToWordCount', () => {
    it('returns same value for chunk size 1', () => {
      expect(rsvpIndexToWordCount(0, 1)).toBe(0);
      expect(rsvpIndexToWordCount(5, 1)).toBe(5);
      expect(rsvpIndexToWordCount(100, 1)).toBe(100);
    });

    it('multiplies by chunk size', () => {
      expect(rsvpIndexToWordCount(5, 2)).toBe(10);
      expect(rsvpIndexToWordCount(3, 3)).toBe(9);
    });

    it('handles edge case of chunk size 0', () => {
      expect(rsvpIndexToWordCount(10, 0)).toBe(0);
    });
  });

  describe('wordCountToPacing', () => {
    it('returns first position for word count 0', () => {
      const blocks = [
        createParagraph('One two three'),
        createParagraph('Four five'),
      ];
      expect(wordCountToPacing(blocks, 0)).toEqual({ blockIndex: 0, wordIndex: 0 });
    });

    it('returns position within first block', () => {
      const blocks = [
        createParagraph('One two three'),
        createParagraph('Four five'),
      ];
      expect(wordCountToPacing(blocks, 2)).toEqual({ blockIndex: 0, wordIndex: 2 });
    });

    it('returns position in second block', () => {
      const blocks = [
        createParagraph('One two three'),  // 3 words
        createParagraph('Four five six'),  // 3 words
      ];
      // Word 4 (0-indexed: 3) is at block 1, word 0
      expect(wordCountToPacing(blocks, 3)).toEqual({ blockIndex: 1, wordIndex: 0 });
      // Word 5 (0-indexed: 4) is at block 1, word 1
      expect(wordCountToPacing(blocks, 4)).toEqual({ blockIndex: 1, wordIndex: 1 });
    });

    it('handles position at end of document', () => {
      const blocks = [
        createParagraph('One two'),     // 2 words
        createParagraph('Three four'),  // 2 words
      ];
      // Word count 10 is beyond end (total is 4), should return last position
      const result = wordCountToPacing(blocks, 10);
      expect(result.blockIndex).toBe(1);
      expect(result.wordIndex).toBe(1); // Last word index in block
    });

    it('handles empty blocks array', () => {
      expect(wordCountToPacing([], 5)).toEqual({ blockIndex: 0, wordIndex: 0 });
    });

    it('handles list blocks correctly', () => {
      const blocks = [
        createList(['One two', 'Three four']),  // 4 words
        createParagraph('Five six'),            // 2 words
      ];
      // Word 5 is at block 1, word 1
      expect(wordCountToPacing(blocks, 5)).toEqual({ blockIndex: 1, wordIndex: 1 });
    });
  });

  describe('getTotalWordCount', () => {
    it('returns 0 for empty blocks', () => {
      expect(getTotalWordCount([])).toBe(0);
    });

    it('sums words across all blocks', () => {
      const blocks = [
        createParagraph('One two three'),  // 3 words
        createParagraph('Four five'),      // 2 words
        createList(['Six', 'Seven']),      // 2 words
      ];
      expect(getTotalWordCount(blocks)).toBe(7);
    });
  });

  describe('round-trip conversions', () => {
    it('pacing -> wordCount -> pacing preserves position', () => {
      const blocks = [
        createParagraph('One two three four five'),  // 5 words
        createParagraph('Six seven eight'),          // 3 words
        createParagraph('Nine ten'),                 // 2 words
      ];

      // Test various positions
      const testCases = [
        { blockIndex: 0, wordIndex: 0 },
        { blockIndex: 0, wordIndex: 3 },
        { blockIndex: 1, wordIndex: 0 },
        { blockIndex: 1, wordIndex: 2 },
        { blockIndex: 2, wordIndex: 1 },
      ];

      for (const { blockIndex, wordIndex } of testCases) {
        const wordCount = pacingToWordCount(blocks, blockIndex, wordIndex);
        const result = wordCountToPacing(blocks, wordCount);
        expect(result).toEqual({ blockIndex, wordIndex });
      }
    });

    it('rsvpIndex -> wordCount -> rsvpIndex preserves position for chunk size 1', () => {
      const testIndices = [0, 5, 10, 50, 100];
      for (const index of testIndices) {
        const wordCount = rsvpIndexToWordCount(index, 1);
        const result = wordCountToRsvpIndex(wordCount, 1);
        expect(result).toBe(index);
      }
    });

    it('pacing -> rsvp -> pacing approximately preserves position with chunk size > 1', () => {
      const blocks = [
        createParagraph('One two three four five six'),  // 6 words
        createParagraph('Seven eight nine ten'),         // 4 words
      ];
      const chunkSize = 2;

      // Position at block 0, word 4 (5th word)
      const wordCount = pacingToWordCount(blocks, 0, 4);
      expect(wordCount).toBe(4);

      // Convert to RSVP (chunk size 2 means token index 2)
      const rsvpIndex = wordCountToRsvpIndex(wordCount, chunkSize);
      expect(rsvpIndex).toBe(2);

      // Convert back - should be at word 4 (start of token 2)
      const backWordCount = rsvpIndexToWordCount(rsvpIndex, chunkSize);
      expect(backWordCount).toBe(4);

      // Back to pacing
      const result = wordCountToPacing(blocks, backWordCount);
      expect(result).toEqual({ blockIndex: 0, wordIndex: 4 });
    });
  });
});
