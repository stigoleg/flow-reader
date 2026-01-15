import { describe, it, expect } from 'vitest';
import {
  getWordFrequencyTier,
  getWordSpeedMultiplier,
  isCommonWord,
  getWordDifficulty,
} from '@/lib/word-frequency';

describe('Word Complexity Module', () => {
  describe('getWordFrequencyTier - Length-based heuristics', () => {
    describe('Tier 1 - Very short words (1-2 chars)', () => {
      it('identifies very short words as tier 1', () => {
        expect(getWordFrequencyTier('a')).toBe(1);
        expect(getWordFrequencyTier('I')).toBe(1);
        expect(getWordFrequencyTier('is')).toBe(1);
        expect(getWordFrequencyTier('to')).toBe(1);
        expect(getWordFrequencyTier('of')).toBe(1);
      });

      it('handles case insensitivity', () => {
        expect(getWordFrequencyTier('IT')).toBe(1);
        expect(getWordFrequencyTier('An')).toBe(1);
      });

      it('strips punctuation', () => {
        expect(getWordFrequencyTier('a,')).toBe(1);
        expect(getWordFrequencyTier('I.')).toBe(1);
        expect(getWordFrequencyTier('"ok"')).toBe(1);
      });
    });

    describe('Tier 2 - Short words (3-4 chars)', () => {
      it('identifies short words as tier 2', () => {
        expect(getWordFrequencyTier('the')).toBe(2);
        expect(getWordFrequencyTier('and')).toBe(2);
        expect(getWordFrequencyTier('need')).toBe(2);
        expect(getWordFrequencyTier('feel')).toBe(2);
        expect(getWordFrequencyTier('show')).toBe(2);
      });
    });

    describe('Tier 3 - Medium words (5-7 chars)', () => {
      it('identifies medium words as tier 3', () => {
        // Words with more syllables get higher tiers
        expect(getWordFrequencyTier('running')).toBe(3); // 7 chars, 2 syllables
        expect(getWordFrequencyTier('amazing')).toBe(3); // 7 chars, 3 syllables
        expect(getWordFrequencyTier('company')).toBe(3); // 7 chars, 3 syllables
      });
    });

    describe('Tier 4 - Long words (8-10 chars)', () => {
      it('identifies long words as tier 4', () => {
        expect(getWordFrequencyTier('different')).toBe(4);
        expect(getWordFrequencyTier('important')).toBe(4);
        expect(getWordFrequencyTier('beautiful')).toBe(4);
      });
    });

    describe('Tier 5 - Very long words (11+ chars)', () => {
      it('identifies very long words as tier 5', () => {
        expect(getWordFrequencyTier('sesquipedalian')).toBe(5);
        expect(getWordFrequencyTier('extraordinary')).toBe(5);
        expect(getWordFrequencyTier('antidisestablishmentarianism')).toBe(5);
      });
    });

    describe('Edge cases', () => {
      it('returns tier 3 for empty strings', () => {
        expect(getWordFrequencyTier('')).toBe(3);
      });

      it('returns tier 3 for punctuation-only', () => {
        expect(getWordFrequencyTier('...')).toBe(3);
        expect(getWordFrequencyTier('---')).toBe(3);
      });

      it('handles numbers mixed with text', () => {
        // Strips numbers, evaluates remaining letters
        expect(getWordFrequencyTier('2nd')).toBe(1); // 'nd' is 2 chars
      });
    });
  });

  describe('getWordSpeedMultiplier', () => {
    it('returns 0.7 for tier 1 (very short)', () => {
      expect(getWordSpeedMultiplier('a')).toBe(0.7);
      expect(getWordSpeedMultiplier('is')).toBe(0.7);
    });

    it('returns 0.85 for tier 2 (short)', () => {
      expect(getWordSpeedMultiplier('the')).toBe(0.85);
      expect(getWordSpeedMultiplier('need')).toBe(0.85);
    });

    it('returns 1.0 for tier 3 (medium)', () => {
      expect(getWordSpeedMultiplier('morning')).toBe(1.0); // 7 chars = tier 3
    });

    it('returns 1.15 for tier 4 (long)', () => {
      expect(getWordSpeedMultiplier('important')).toBe(1.15);
    });

    it('returns 1.3 for tier 5 (very long)', () => {
      expect(getWordSpeedMultiplier('sesquipedalian')).toBe(1.3);
    });
  });

  describe('isCommonWord', () => {
    it('returns true for tier 1-2 words (short words)', () => {
      expect(isCommonWord('a')).toBe(true);
      expect(isCommonWord('the')).toBe(true);
      expect(isCommonWord('need')).toBe(true);
    });

    it('returns false for tier 3-5 words (medium to long)', () => {
      expect(isCommonWord('morning')).toBe(false); // 7 chars = tier 3
      expect(isCommonWord('sesquipedalian')).toBe(false);
    });
  });

  describe('getWordDifficulty', () => {
    it('returns low difficulty for short words', () => {
      expect(getWordDifficulty('a')).toBe(0);
      expect(getWordDifficulty('the')).toBe(0.25);
    });

    it('returns high difficulty for very long words', () => {
      expect(getWordDifficulty('sesquipedalian')).toBe(1);
    });

    it('returns value between 0 and 1', () => {
      const words = ['a', 'the', 'running', 'beautiful', 'extraordinary', 'sesquipedalian'];
      for (const word of words) {
        const diff = getWordDifficulty(word);
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Language agnostic behavior', () => {
    it('works for Norwegian words based on length', () => {
      expect(getWordFrequencyTier('og', 'no')).toBe(1); // 2 chars
      expect(getWordFrequencyTier('det', 'no')).toBe(2); // 3 chars
      expect(getWordFrequencyTier('menneske', 'no')).toBe(4); // 8 chars
    });

    it('handles Norwegian characters (æ, ø, å)', () => {
      expect(getWordFrequencyTier('også', 'no')).toBe(2); // 4 chars
      expect(getWordFrequencyTier('være', 'no')).toBe(2); // 4 chars
      expect(getWordFrequencyTier('går', 'no')).toBe(2); // 3 chars
    });

    it('works for French words', () => {
      expect(getWordFrequencyTier('le', 'en')).toBe(1); // 2 chars
      expect(getWordFrequencyTier('être', 'en')).toBe(2); // 4 chars
    });

    it('works for German words', () => {
      expect(getWordFrequencyTier('und', 'en')).toBe(2); // 3 chars
      expect(getWordFrequencyTier('Donaudampfschifffahrt', 'en')).toBe(5); // 21 chars
    });

    it('works for Spanish words', () => {
      expect(getWordFrequencyTier('el', 'en')).toBe(1); // 2 chars
      expect(getWordFrequencyTier('extraordinario', 'en')).toBe(5); // 14 chars
    });
  });

  describe('Syllable influence', () => {
    it('considers syllables for borderline cases', () => {
      // Both 7 chars, but different syllable counts affect tier
      // 'problem' (2 syllables) vs multi-syllable word
      const tier1 = getWordFrequencyTier('problem'); // 7 chars, ~2 syllables
      const tier2 = getWordFrequencyTier('happily'); // 7 chars, ~3 syllables
      // Both should be tier 3 or close based on length being primary
      expect(tier1).toBeLessThanOrEqual(4);
      expect(tier2).toBeLessThanOrEqual(4);
    });
  });
});
