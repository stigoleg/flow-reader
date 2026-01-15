import { describe, it, expect } from 'vitest';
import { 
  bionicWord, 
  bionicText, 
  bionicFontWeight,
  adaptiveBionicWord,
  adaptiveBionicText,
  getProportionForWPM,
} from '@/lib/bionic';

describe('Bionic Reading', () => {
  describe('bionicWord', () => {
    it('handles empty string', () => {
      const result = bionicWord('', 0.4);
      expect(result).toEqual({ bold: '', regular: '' });
    });

    it('handles single character', () => {
      const result = bionicWord('a', 0.4);
      expect(result).toEqual({ bold: 'a', regular: '' });
    });

    it('handles short words (3 chars)', () => {
      const result = bionicWord('the', 0.4);
      expect(result.bold).toBe('t');
      expect(result.regular).toBe('he');
    });

    it('handles medium words with 40% proportion', () => {
      const result = bionicWord('reading', 0.4);
      // 7 chars * 0.4 = 2.8, rounds to 3
      expect(result.bold).toBe('rea');
      expect(result.regular).toBe('ding');
    });

    it('handles long words', () => {
      const result = bionicWord('comprehension', 0.4);
      // 13 chars * 0.4 = 5.2, rounds to 5
      expect(result.bold).toBe('compr');
      expect(result.regular).toBe('ehension');
    });

    it('respects different proportions', () => {
      const result30 = bionicWord('testing', 0.3);
      const result50 = bionicWord('testing', 0.5);

      expect(result30.bold.length).toBeLessThan(result50.bold.length);
    });
  });

  describe('bionicText', () => {
    it('transforms simple sentence', () => {
      const result = bionicText('Hello world', 0.4);

      expect(result).toHaveLength(3); // Hello, space, world
      // 5 chars * 0.4 = 2, so 'He' is bold
      expect(result[0].bold).toBe('He');
      expect(result[0].regular).toBe('llo');
      expect(result[1]).toEqual({ bold: '', regular: ' ' });
      expect(result[2].bold).toBe('wo');
      expect(result[2].regular).toBe('rld');
    });

    it('preserves punctuation', () => {
      const result = bionicText('Hello, world!', 0.4);

      // Should have: Hello, comma+space, world!
      expect(result.some((w) => w.regular.includes(','))).toBe(true);
    });

    it('handles empty text', () => {
      const result = bionicText('', 0.4);
      expect(result).toEqual([]);
    });
  });

  describe('bionicFontWeight', () => {
    it('returns 600 for 0 intensity', () => {
      expect(bionicFontWeight(0)).toBe(600);
    });

    it('returns 800 for 1.0 intensity', () => {
      expect(bionicFontWeight(1)).toBe(800);
    });

    it('returns 700 for 0.5 intensity', () => {
      expect(bionicFontWeight(0.5)).toBe(700);
    });
  });

  describe('adaptiveBionicWord', () => {
    it('handles empty string', () => {
      const result = adaptiveBionicWord('', 0.4);
      expect(result).toEqual({ bold: '', regular: '', frequencyTier: 3 });
    });

    it('returns frequencyTier 1 for very common words', () => {
      const result = adaptiveBionicWord('the', 0.4);
      expect(result.frequencyTier).toBe(1);
    });

    it('returns frequencyTier 2 for common words', () => {
      const result = adaptiveBionicWord('important', 0.4);
      expect(result.frequencyTier).toBe(2);
    });

    it('returns frequencyTier 4 for unknown words (default tier)', () => {
      const result = adaptiveBionicWord('xyzzyflux', 0.4);
      expect(result.frequencyTier).toBe(4);
    });

    it('applies less bolding to common words', () => {
      // Common words should get less bolding (proportion reduced)
      const commonWord = adaptiveBionicWord('because', 0.4); // tier 1
      const rareWord = adaptiveBionicWord('ephemeral', 0.4); // tier 5 (unknown)
      
      // With 7+ chars, tier 1 gets 0.4 * 0.7 = 0.28, tier 5 gets 0.4 * 1.3 = 0.52
      // Common word should have shorter bold portion
      expect(commonWord.bold.length).toBeLessThan(rareWord.bold.length);
    });

    it('applies more bolding to rare words', () => {
      // "philosophy" is tier 5 (rare academic), should get 30% more bolding
      const result = adaptiveBionicWord('philosophy', 0.4);
      expect(result.frequencyTier).toBe(5);
      // 10 chars * 0.4 * 1.3 = 5.2, rounds to 5
      expect(result.bold.length).toBeGreaterThanOrEqual(5);
    });

    it('uses default proportion of 0.4', () => {
      const withDefault = adaptiveBionicWord('testing');
      const withExplicit = adaptiveBionicWord('testing', 0.4);
      expect(withDefault).toEqual(withExplicit);
    });

    it('clamps proportion to minimum 0.2', () => {
      // Very low base proportion with tier 1 word
      // 0.1 * 0.7 = 0.07, should clamp to 0.2
      const result = adaptiveBionicWord('the', 0.1);
      // 3 chars * 0.2 = 0.6, floor = 0, but min is 1
      expect(result.bold.length).toBeGreaterThanOrEqual(1);
    });

    it('clamps proportion to maximum 0.6', () => {
      // High base proportion with tier 5 word
      // 0.6 * 1.3 = 0.78, should clamp to 0.6
      const result = adaptiveBionicWord('xyzzy', 0.6);
      // 5 chars * 0.6 = 3
      expect(result.bold.length).toBeLessThanOrEqual(3);
    });
  });

  describe('adaptiveBionicText', () => {
    it('handles empty text', () => {
      const result = adaptiveBionicText('');
      expect(result).toEqual([]);
    });

    it('transforms text with frequency tiers', () => {
      const result = adaptiveBionicText('The quick');
      
      expect(result).toHaveLength(3); // The, space, quick
      expect(result[0].frequencyTier).toBe(1); // "the" is very common
      expect(result[1]).toEqual({ bold: '', regular: ' ', frequencyTier: 3 }); // space
      expect(result[2].frequencyTier).toBe(3); // "quick" is tier 3 (standard)
    });

    it('applies different bolding based on word frequency', () => {
      const result = adaptiveBionicText('I discombobulated');
      
      // "I" is tier 1 (very common), gets less bolding
      // "discombobulated" is tier 5 (rare), gets more bolding
      expect(result[0].frequencyTier).toBe(1);
      expect(result[2].frequencyTier).toBe(5);
    });

    it('preserves whitespace with default tier', () => {
      const result = adaptiveBionicText('hello world');
      
      const space = result[1];
      expect(space.bold).toBe('');
      expect(space.regular).toBe(' ');
      expect(space.frequencyTier).toBe(3);
    });

    it('uses default proportion of 0.4', () => {
      const withDefault = adaptiveBionicText('test');
      const withExplicit = adaptiveBionicText('test', 0.4);
      expect(withDefault).toEqual(withExplicit);
    });

    it('respects custom base proportion', () => {
      const lowProportion = adaptiveBionicText('reading', 0.3);
      const highProportion = adaptiveBionicText('reading', 0.5);
      
      // Higher base proportion should result in longer bold portions
      expect(lowProportion[0].bold.length).toBeLessThanOrEqual(highProportion[0].bold.length);
    });
  });

  describe('getProportionForWPM', () => {
    it('returns 0.35 for slow reading speeds (<200 WPM)', () => {
      expect(getProportionForWPM(150)).toBe(0.35);
      expect(getProportionForWPM(100)).toBe(0.35);
      expect(getProportionForWPM(199)).toBe(0.35);
    });

    it('returns 0.4 for normal reading speeds (200-399 WPM)', () => {
      expect(getProportionForWPM(200)).toBe(0.4);
      expect(getProportionForWPM(300)).toBe(0.4);
      expect(getProportionForWPM(399)).toBe(0.4);
    });

    it('returns 0.45 for fast reading speeds (400-599 WPM)', () => {
      expect(getProportionForWPM(400)).toBe(0.45);
      expect(getProportionForWPM(500)).toBe(0.45);
      expect(getProportionForWPM(599)).toBe(0.45);
    });

    it('returns 0.5 for very fast reading speeds (600+ WPM)', () => {
      expect(getProportionForWPM(600)).toBe(0.5);
      expect(getProportionForWPM(800)).toBe(0.5);
      expect(getProportionForWPM(1000)).toBe(0.5);
    });

    it('handles edge cases at boundaries', () => {
      expect(getProportionForWPM(199)).toBe(0.35);
      expect(getProportionForWPM(200)).toBe(0.4);
      expect(getProportionForWPM(399)).toBe(0.4);
      expect(getProportionForWPM(400)).toBe(0.45);
      expect(getProportionForWPM(599)).toBe(0.45);
      expect(getProportionForWPM(600)).toBe(0.5);
    });
  });
});
