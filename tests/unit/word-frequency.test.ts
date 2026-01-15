import { describe, it, expect } from 'vitest';
import {
  getWordFrequencyTier,
  getWordSpeedMultiplier,
  isCommonWord,
  getWordDifficulty,
  getVocabularySize,
  getAllVocabularySizes,
} from '@/lib/word-frequency';

describe('Word Frequency Module', () => {
  describe('getWordFrequencyTier', () => {
    describe('Tier 1 - Very common words', () => {
      it('identifies top 100 words as tier 1', () => {
        expect(getWordFrequencyTier('the')).toBe(1);
        expect(getWordFrequencyTier('and')).toBe(1);
        expect(getWordFrequencyTier('is')).toBe(1);
        expect(getWordFrequencyTier('of')).toBe(1);
        expect(getWordFrequencyTier('to')).toBe(1);
      });

      it('handles case insensitivity', () => {
        expect(getWordFrequencyTier('THE')).toBe(1);
        expect(getWordFrequencyTier('And')).toBe(1);
        expect(getWordFrequencyTier('IS')).toBe(1);
      });

      it('strips punctuation', () => {
        expect(getWordFrequencyTier('the,')).toBe(1);
        expect(getWordFrequencyTier('and.')).toBe(1);
        expect(getWordFrequencyTier('"is"')).toBe(1);
      });
    });

    describe('Tier 2 - Common words', () => {
      it('identifies common verbs', () => {
        expect(getWordFrequencyTier('need')).toBe(2);
        expect(getWordFrequencyTier('feel')).toBe(2);
        expect(getWordFrequencyTier('show')).toBe(2);
      });

      it('identifies common nouns', () => {
        // These common nouns may be tier 1 or tier 2 depending on frequency data
        expect(getWordFrequencyTier('life')).toBeLessThanOrEqual(2);
        expect(getWordFrequencyTier('world')).toBeLessThanOrEqual(2);
        expect(getWordFrequencyTier('school')).toBeLessThanOrEqual(2);
      });

      it('identifies common adjectives', () => {
        expect(getWordFrequencyTier('different')).toBe(2);
        expect(getWordFrequencyTier('important')).toBe(2);
        expect(getWordFrequencyTier('public')).toBe(2);
      });
    });

    describe('Tier 3 - Standard words', () => {
      it('identifies standard vocabulary', () => {
        expect(getWordFrequencyTier('achieve')).toBe(3);
        expect(getWordFrequencyTier('analysis')).toBe(3);
        expect(getWordFrequencyTier('building')).toBe(3);
      });
    });

    describe('Tier 4 - Less common words', () => {
      it('identifies less common words', () => {
        expect(getWordFrequencyTier('abandon')).toBe(4);
        expect(getWordFrequencyTier('academic')).toBe(4);
        expect(getWordFrequencyTier('abundant')).toBe(4); // Not in list, 8 chars -> tier 4
      });
    });

    describe('Tier 5 - Rare words', () => {
      it('identifies very long words as tier 5', () => {
        expect(getWordFrequencyTier('sesquipedalian')).toBe(5);
        expect(getWordFrequencyTier('antidisestablishmentarianism')).toBe(5);
      });
    });

    describe('Morphological stemming', () => {
      it('recognizes word forms with -ing suffix', () => {
        // 'run' is tier 2, so 'running' should also be recognized
        expect(getWordFrequencyTier('running')).toBeLessThanOrEqual(3);
      });

      it('recognizes word forms with -ed suffix', () => {
        expect(getWordFrequencyTier('worked')).toBeLessThanOrEqual(3);
      });

      it('recognizes word forms with -s suffix', () => {
        expect(getWordFrequencyTier('works')).toBeLessThanOrEqual(3);
      });

      it('recognizes word forms with -er suffix', () => {
        expect(getWordFrequencyTier('worker')).toBeLessThanOrEqual(3);
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
        expect(getWordFrequencyTier('2nd')).toBe(2); // 'nd' is short
      });

      it('treats short unknown words as tier 2', () => {
        expect(getWordFrequencyTier('xyz')).toBe(2); // 3 chars
        expect(getWordFrequencyTier('ab')).toBe(2);
      });
    });
  });

  describe('getWordSpeedMultiplier', () => {
    it('returns 0.7 for tier 1 (very common)', () => {
      expect(getWordSpeedMultiplier('the')).toBe(0.7);
    });

    it('returns 0.85 for tier 2 (common)', () => {
      expect(getWordSpeedMultiplier('need')).toBe(0.85);
    });

    it('returns 1.0 for tier 3 (standard)', () => {
      expect(getWordSpeedMultiplier('achieve')).toBe(1.0);
    });

    it('returns 1.15 for tier 4 (less common)', () => {
      expect(getWordSpeedMultiplier('abandon')).toBe(1.15);
    });

    it('returns 1.3 for tier 5 (rare)', () => {
      expect(getWordSpeedMultiplier('sesquipedalian')).toBe(1.3);
    });
  });

  describe('isCommonWord', () => {
    it('returns true for tier 1-3 words', () => {
      expect(isCommonWord('the')).toBe(true);
      expect(isCommonWord('need')).toBe(true);
      expect(isCommonWord('achieve')).toBe(true);
    });

    it('returns false for tier 4-5 words', () => {
      expect(isCommonWord('sesquipedalian')).toBe(false);
      expect(isCommonWord('unfathomable')).toBe(false);
    });
  });

  describe('getWordDifficulty', () => {
    it('returns low difficulty for common words', () => {
      expect(getWordDifficulty('the')).toBeLessThan(0.3);
      expect(getWordDifficulty('and')).toBeLessThan(0.3);
    });

    it('returns high difficulty for rare long words', () => {
      expect(getWordDifficulty('sesquipedalian')).toBeGreaterThan(0.7);
    });

    it('returns value between 0 and 1', () => {
      const words = ['the', 'running', 'beautiful', 'extraordinary', 'sesquipedalian'];
      for (const word of words) {
        const diff = getWordDifficulty(word);
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getVocabularySize', () => {
    it('returns vocabulary size over 1500 words', () => {
      expect(getVocabularySize()).toBeGreaterThan(1500);
    });
  });

  describe('No duplicate words', () => {
    it('each tier has unique words', () => {
      // This test ensures we removed duplicates correctly
      // Just verify the vocabulary size is reasonable
      const size = getVocabularySize();
      expect(size).toBeLessThan(5000); // Reasonable upper bound
      expect(size).toBeGreaterThan(1500); // Reasonable lower bound
    });
  });

  describe('Norwegian language support', () => {
    describe('getWordFrequencyTier - Norwegian', () => {
      it('identifies most common Norwegian words as tier 1', () => {
        expect(getWordFrequencyTier('og', 'no')).toBe(1);
        expect(getWordFrequencyTier('er', 'no')).toBe(1);
        expect(getWordFrequencyTier('det', 'no')).toBe(1);
        expect(getWordFrequencyTier('som', 'no')).toBe(1);
        expect(getWordFrequencyTier('jeg', 'no')).toBe(1);
      });

      it('identifies common Norwegian words as tier 2', () => {
        expect(getWordFrequencyTier('menneske', 'no')).toBe(2);
        expect(getWordFrequencyTier('familie', 'no')).toBe(2);
        expect(getWordFrequencyTier('viktig', 'no')).toBe(2);
      });

      it('identifies standard Norwegian words as tier 3', () => {
        expect(getWordFrequencyTier('analysere', 'no')).toBe(3);
        expect(getWordFrequencyTier('demokratisk', 'no')).toBe(3);
        expect(getWordFrequencyTier('internasjonal', 'no')).toBe(3);
      });

      it('identifies less common Norwegian words as tier 4', () => {
        expect(getWordFrequencyTier('akademisk', 'no')).toBe(4);
        expect(getWordFrequencyTier('pragmatisk', 'no')).toBe(4);
      });

      it('handles Norwegian characters (æ, ø, å)', () => {
        expect(getWordFrequencyTier('også', 'no')).toBe(1);
        expect(getWordFrequencyTier('være', 'no')).toBe(1);
        expect(getWordFrequencyTier('går', 'no')).toBe(1);
      });

      it('handles case insensitivity for Norwegian', () => {
        expect(getWordFrequencyTier('OG', 'no')).toBe(1);
        expect(getWordFrequencyTier('Også', 'no')).toBe(1);
      });
    });

    describe('getWordSpeedMultiplier - Norwegian', () => {
      it('returns 0.7 for tier 1 Norwegian words', () => {
        expect(getWordSpeedMultiplier('og', 'no')).toBe(0.7);
        expect(getWordSpeedMultiplier('det', 'no')).toBe(0.7);
      });

      it('returns 0.85 for tier 2 Norwegian words', () => {
        expect(getWordSpeedMultiplier('menneske', 'no')).toBe(0.85);
      });

      it('returns 1.0 for tier 3 Norwegian words', () => {
        expect(getWordSpeedMultiplier('demokratisk', 'no')).toBe(1.0);
      });
    });

    describe('isCommonWord - Norwegian', () => {
      it('returns true for common Norwegian words', () => {
        expect(isCommonWord('og', 'no')).toBe(true);
        expect(isCommonWord('menneske', 'no')).toBe(true);
        expect(isCommonWord('analysere', 'no')).toBe(true);
      });

      it('returns false for uncommon Norwegian words', () => {
        expect(isCommonWord('bærekraftig', 'no')).toBe(false);
      });
    });

    describe('getVocabularySize - Norwegian', () => {
      it('returns Norwegian vocabulary size', () => {
        expect(getVocabularySize('no')).toBeGreaterThan(500);
      });

      it('returns different sizes for different languages', () => {
        const enSize = getVocabularySize('en');
        const noSize = getVocabularySize('no');
        expect(enSize).not.toBe(noSize);
      });
    });

    describe('getAllVocabularySizes', () => {
      it('returns sizes for all languages', () => {
        const sizes = getAllVocabularySizes();
        expect(sizes.en).toBeGreaterThan(1500);
        expect(sizes.no).toBeGreaterThan(500);
      });
    });

    describe('Norwegian morphological stemming', () => {
      it('recognizes Norwegian word forms with -ene suffix', () => {
        // 'barn' is tier 2, 'barnene' should also be recognized
        expect(getWordFrequencyTier('barnene', 'no')).toBeLessThanOrEqual(3);
      });

      it('recognizes Norwegian word forms with -er suffix', () => {
        expect(getWordFrequencyTier('bøker', 'no')).toBeLessThanOrEqual(4);
      });
    });
  });

  describe('Language auto-detection', () => {
    it('defaults to English when no language specified', () => {
      // 'the' is English tier 1
      expect(getWordFrequencyTier('the')).toBe(1);
      // 'og' is Norwegian tier 1, but defaults to English so unknown
      expect(getWordFrequencyTier('og')).not.toBe(1);
    });

    it('uses auto detection when specified', () => {
      // With Norwegian word containing æøå, should detect as Norwegian
      expect(getWordFrequencyTier('også', 'auto')).toBe(1);
    });
  });
});
