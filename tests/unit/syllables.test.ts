import { describe, it, expect, beforeEach } from 'vitest';
import {
  countSyllables,
  detectLanguage,
  countTotalSyllables,
  loadSyllableDictionary,
  clearSyllableDictionary,
  countSyllablesBatch,
} from '../../src/lib/syllables';

describe('syllables module', () => {
  describe('countSyllables - English', () => {
    it('returns 1 for single syllable words', () => {
      expect(countSyllables('cat', 'en')).toBe(1);
      expect(countSyllables('dog', 'en')).toBe(1);
      expect(countSyllables('the', 'en')).toBe(1);
      expect(countSyllables('eye', 'en')).toBe(1);
    });

    it('returns 2 for two syllable words', () => {
      expect(countSyllables('happy', 'en')).toBe(2);
      expect(countSyllables('rhythm', 'en')).toBe(2);
      expect(countSyllables('being', 'en')).toBe(2);
      expect(countSyllables('cafe', 'en')).toBe(2);
    });

    it('returns 3 for three syllable words', () => {
      expect(countSyllables('beautiful', 'en')).toBe(3);
      expect(countSyllables('chocolate', 'en')).toBe(3);
      expect(countSyllables('probably', 'en')).toBe(3);
      expect(countSyllables('recipe', 'en')).toBe(3);
    });

    it('returns 4+ for complex words', () => {
      expect(countSyllables('interesting', 'en')).toBe(4);
      expect(countSyllables('comfortable', 'en')).toBe(4);
      expect(countSyllables('definitely', 'en')).toBe(4);
      expect(countSyllables('especially', 'en')).toBe(5);
    });

    it('handles silent e correctly', () => {
      expect(countSyllables('make', 'en')).toBe(1);
      expect(countSyllables('take', 'en')).toBe(1);
      expect(countSyllables('life', 'en')).toBe(1);
    });

    it('handles consonant+le endings', () => {
      expect(countSyllables('table', 'en')).toBe(2);
      expect(countSyllables('apple', 'en')).toBe(2);
      expect(countSyllables('bottle', 'en')).toBe(2);
    });

    it('handles -ed endings', () => {
      expect(countSyllables('walked', 'en')).toBe(1);
      expect(countSyllables('jumped', 'en')).toBe(1);
      expect(countSyllables('wanted', 'en')).toBe(2);
      expect(countSyllables('needed', 'en')).toBe(2);
    });

    it('handles -es endings', () => {
      expect(countSyllables('boxes', 'en')).toBe(2);
      expect(countSyllables('watches', 'en')).toBe(2);
      expect(countSyllables('makes', 'en')).toBe(1);
    });

    it('returns 1 for very short words', () => {
      expect(countSyllables('a', 'en')).toBe(1);
      expect(countSyllables('I', 'en')).toBe(1);
      expect(countSyllables('to', 'en')).toBe(1);
    });

    it('returns 0 for empty strings', () => {
      expect(countSyllables('', 'en')).toBe(0);
    });

    it('strips punctuation', () => {
      expect(countSyllables('hello!', 'en')).toBe(2);
      expect(countSyllables("don't", 'en')).toBe(1);
    });
  });

  describe('countSyllables - Norwegian', () => {
    it('returns 1 for single syllable Norwegian words', () => {
      expect(countSyllables('jeg', 'no')).toBe(1);
      expect(countSyllables('deg', 'no')).toBe(1);
      expect(countSyllables('nei', 'no')).toBe(1);
      expect(countSyllables('hva', 'no')).toBe(1);
      expect(countSyllables('hvor', 'no')).toBe(1);
    });

    it('returns 2 for two syllable Norwegian words', () => {
      expect(countSyllables('være', 'no')).toBe(2);
      expect(countSyllables('kunne', 'no')).toBe(2);
      expect(countSyllables('ville', 'no')).toBe(2);
      expect(countSyllables('hvordan', 'no')).toBe(2);
      expect(countSyllables('kanskje', 'no')).toBe(2);
    });

    it('returns 3+ for multi-syllable Norwegian words', () => {
      expect(countSyllables('egentlig', 'no')).toBe(3);
      expect(countSyllables('naturlig', 'no')).toBe(3);
      expect(countSyllables('vanligvis', 'no')).toBe(4);
      expect(countSyllables('opplevelse', 'no')).toBe(4);
    });

    it('handles Norwegian vowels (æ, ø, å)', () => {
      expect(countSyllables('øye', 'no')).toBe(2);
      expect(countSyllables('øyne', 'no')).toBe(2);
      expect(countSyllables('både', 'no')).toBe(2);
      expect(countSyllables('også', 'no')).toBe(2);
    });

    it('handles Norwegian diphthongs as single syllables', () => {
      expect(countSyllables('seier', 'no')).toBe(2); // sei-er
      expect(countSyllables('veien', 'no')).toBe(2); // vei-en
    });
  });

  describe('countSyllables - auto detection', () => {
    it('defaults to auto detection', () => {
      // Should work without specifying language
      expect(countSyllables('hello')).toBeGreaterThan(0);
    });

    it('uses text context for detection', () => {
      const norwegianContext = 'Dette er en norsk tekst med mange ord';
      expect(countSyllables('være', 'auto', norwegianContext)).toBe(2);
    });
  });

  describe('detectLanguage', () => {
    it('detects Norwegian from special characters', () => {
      expect(detectLanguage('Dette er en tekst med æ, ø og å')).toBe('no');
      expect(detectLanguage('Hva skjer med været?')).toBe('no');
    });

    it('detects Norwegian from common words', () => {
      expect(detectLanguage('Jeg skal gå til butikken og kjøpe melk')).toBe('no');
      expect(detectLanguage('Hun har ikke tid til dette nå')).toBe('no');
    });

    it('detects English from common words', () => {
      expect(detectLanguage('This is a sample English text')).toBe('en');
      expect(detectLanguage('The quick brown fox jumps over the lazy dog')).toBe('en');
    });

    it('defaults to English for ambiguous text', () => {
      expect(detectLanguage('Hello world')).toBe('en');
      expect(detectLanguage('Test')).toBe('en');
    });

    it('handles mixed content', () => {
      // Slight Norwegian prevalence
      expect(detectLanguage('Jeg will go to the store og handle')).toBe('en');
      // Strong Norwegian prevalence
      expect(detectLanguage('Jeg vil gå til butikken og handle mat til middag')).toBe('no');
    });
  });

  describe('countTotalSyllables', () => {
    it('counts syllables in a sentence', () => {
      const text = 'The cat sat on the mat';
      expect(countTotalSyllables(text, 'en')).toBe(6); // 1+1+1+1+1+1
    });

    it('handles multi-syllable words', () => {
      const text = 'beautiful chocolate recipe';
      expect(countTotalSyllables(text, 'en')).toBe(9); // 3+3+3
    });

    it('auto-detects language', () => {
      const norwegianText = 'Jeg går til butikken';
      const result = countTotalSyllables(norwegianText, 'auto');
      expect(result).toBeGreaterThan(0);
    });

    it('handles empty text', () => {
      expect(countTotalSyllables('', 'en')).toBe(0);
      expect(countTotalSyllables('   ', 'en')).toBe(0);
    });
  });

  describe('countSyllablesBatch', () => {
    it('counts syllables for multiple words', () => {
      const words = ['cat', 'happy', 'beautiful'];
      const result = countSyllablesBatch(words, 'en');
      expect(result).toEqual([1, 2, 3]);
    });

    it('detects language once for batch', () => {
      const words = ['jeg', 'være', 'kanskje'];
      const context = 'Dette er norsk tekst med æ og ø';
      const result = countSyllablesBatch(words, 'auto', context);
      expect(result).toEqual([1, 2, 2]);
    });

    it('handles empty array', () => {
      expect(countSyllablesBatch([], 'en')).toEqual([]);
    });
  });

  describe('loadSyllableDictionary', () => {
    beforeEach(() => {
      // Clear any loaded dictionaries before each test
      clearSyllableDictionary('en');
      clearSyllableDictionary('no');
    });

    it('loads custom dictionary entries', () => {
      loadSyllableDictionary('en', {
        'supercalifragilisticexpialidocious': 14,
        'antidisestablishmentarianism': 12,
      });
      
      expect(countSyllables('supercalifragilisticexpialidocious', 'en')).toBe(14);
      expect(countSyllables('antidisestablishmentarianism', 'en')).toBe(12);
    });

    it('extends existing dictionary', () => {
      loadSyllableDictionary('en', { 'customword': 3 });
      loadSyllableDictionary('en', { 'anotherword': 4 });
      
      expect(countSyllables('customword', 'en')).toBe(3);
      expect(countSyllables('anotherword', 'en')).toBe(4);
    });

    it('exceptions take priority over extended dictionary', () => {
      // 'the' is in exceptions as 1 syllable
      loadSyllableDictionary('en', { 'the': 5 });
      
      // Exception should still return 1
      expect(countSyllables('the', 'en')).toBe(1);
    });

    it('works for Norwegian', () => {
      loadSyllableDictionary('no', {
        'komplisert': 4,
      });
      
      expect(countSyllables('komplisert', 'no')).toBe(4);
    });
  });

  describe('clearSyllableDictionary', () => {
    it('clears loaded dictionary entries', () => {
      loadSyllableDictionary('en', { 'testword': 5 });
      expect(countSyllables('testword', 'en')).toBe(5);
      
      clearSyllableDictionary('en');
      
      // Should now use heuristic counting
      const heuristicResult = countSyllables('testword', 'en');
      expect(heuristicResult).not.toBe(5);
    });
  });

  describe('edge cases', () => {
    it('handles numbers and special characters', () => {
      expect(countSyllables('123', 'en')).toBe(0);
      expect(countSyllables('!!!', 'en')).toBe(0);
      expect(countSyllables('@#$', 'en')).toBe(0);
    });

    it('handles hyphenated words', () => {
      // Should count syllables in the word parts
      expect(countSyllables('self-aware', 'en')).toBeGreaterThan(0);
    });

    it('handles uppercase words', () => {
      expect(countSyllables('HELLO', 'en')).toBe(2);
      expect(countSyllables('BEAUTIFUL', 'en')).toBe(3);
    });

    it('handles mixed case', () => {
      expect(countSyllables('HeLLo', 'en')).toBe(2);
    });
  });
});
