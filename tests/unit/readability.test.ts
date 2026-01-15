import { describe, it, expect } from 'vitest';
import {
  calculateReadability,
  getReadabilityDescription,
  getAdjustedWPM,
  analyzeBlocks,
  splitIntoSentences,
  getReadabilityReport,
} from '@/lib/readability';

describe('Readability Module', () => {
  describe('splitIntoSentences', () => {
    it('splits simple sentences correctly', () => {
      const sentences = splitIntoSentences('Hello world. This is a test.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('Hello world');
      expect(sentences[1]).toContain('This is a test');
    });

    it('handles abbreviations correctly', () => {
      const sentences = splitIntoSentences('Dr. Smith went to the store. He bought milk.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('Dr. Smith');
    });

    it('handles Mr. Mrs. Ms. titles', () => {
      const sentences = splitIntoSentences('Mr. and Mrs. Jones arrived. They were happy.');
      expect(sentences).toHaveLength(2);
    });

    it('handles etc. abbreviation', () => {
      const sentences = splitIntoSentences('We need apples, oranges, etc. The list goes on.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('etc.');
    });

    it('handles vs. abbreviation', () => {
      const sentences = splitIntoSentences('It was us vs. them. We won.');
      expect(sentences).toHaveLength(2);
    });

    it('handles single letter initials', () => {
      const sentences = splitIntoSentences('J. K. Rowling wrote books. She is famous.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('J. K. Rowling');
    });

    it('handles U.S. and similar abbreviations', () => {
      const sentences = splitIntoSentences('The U.S. is a country. It has many states.');
      expect(sentences).toHaveLength(2);
    });

    it('handles question marks', () => {
      const sentences = splitIntoSentences('Is this a question? Yes it is.');
      expect(sentences).toHaveLength(2);
    });

    it('handles exclamation marks', () => {
      const sentences = splitIntoSentences('Wow! That is amazing!');
      expect(sentences).toHaveLength(2);
    });

    it('handles multiple punctuation', () => {
      const sentences = splitIntoSentences('Really?! Yes, really.');
      expect(sentences).toHaveLength(2);
    });

    it('handles quotes after punctuation', () => {
      const sentences = splitIntoSentences('"Hello." She said hello.');
      expect(sentences).toHaveLength(2);
    });

    it('returns single sentence for text without punctuation', () => {
      const sentences = splitIntoSentences('This has no punctuation');
      expect(sentences).toHaveLength(1);
    });

    it('handles empty string', () => {
      const sentences = splitIntoSentences('');
      expect(sentences).toHaveLength(0);
    });
  });

  describe('calculateReadability', () => {
    it('returns correct structure', () => {
      const score = calculateReadability('This is a simple test sentence.');
      
      expect(score).toHaveProperty('fleschReadingEase');
      expect(score).toHaveProperty('fleschKincaidGrade');
      expect(score).toHaveProperty('gunningFogIndex');
      expect(score).toHaveProperty('smogIndex');
      expect(score).toHaveProperty('avgWordsPerSentence');
      expect(score).toHaveProperty('avgSyllablesPerWord');
      expect(score).toHaveProperty('complexWordPercentage');
      expect(score).toHaveProperty('difficultyLevel');
      expect(score).toHaveProperty('wpmMultiplier');
    });

    it('scores simple text as easy', () => {
      const score = calculateReadability('The cat sat on the mat. It was a good cat.');
      
      expect(score.fleschReadingEase).toBeGreaterThan(70);
      expect(score.difficultyLevel).toBe('easy');
      expect(score.wpmMultiplier).toBeGreaterThan(1);
    });

    it('scores complex text as hard', () => {
      const complexText = `The epistemological implications of quantum entanglement 
        necessitate a fundamental reconceptualization of causality. 
        Consequently, philosophical frameworks predicated upon 
        deterministic assumptions require substantial modification.`;
      
      const score = calculateReadability(complexText);
      
      expect(score.fleschReadingEase).toBeLessThan(40);
      expect(['hard', 'very-hard']).toContain(score.difficultyLevel);
      expect(score.wpmMultiplier).toBeLessThan(1);
    });

    it('handles empty text', () => {
      const score = calculateReadability('');
      
      expect(score.fleschReadingEase).toBe(100);
      expect(score.fleschKincaidGrade).toBe(0);
      expect(score.difficultyLevel).toBe('easy');
    });

    it('calculates correct average words per sentence', () => {
      const score = calculateReadability('One two three. Four five.');
      
      expect(score.avgWordsPerSentence).toBeCloseTo(2.5, 1);
    });

    it('counts complex words correctly', () => {
      // "understanding" and "comprehension" are complex (3+ syllables)
      const score = calculateReadability('Understanding and comprehension are important.');
      
      expect(score.complexWordPercentage).toBeGreaterThan(0);
    });

    it('handles text with abbreviations for sentence count', () => {
      // Should be 2 sentences, not 4 (Dr. and etc. are abbreviations)
      const score = calculateReadability('Dr. Smith likes apples, oranges, etc. He is a doctor.');
      
      expect(score.avgWordsPerSentence).toBeGreaterThan(3);
    });
  });

  describe('Readability indices', () => {
    it('calculates Flesch Reading Ease in valid range', () => {
      const score = calculateReadability('This is a test of the readability system.');
      
      expect(score.fleschReadingEase).toBeGreaterThanOrEqual(0);
      expect(score.fleschReadingEase).toBeLessThanOrEqual(100);
    });

    it('calculates Flesch-Kincaid Grade as non-negative', () => {
      const score = calculateReadability('Simple words here.');
      
      expect(score.fleschKincaidGrade).toBeGreaterThanOrEqual(0);
    });

    it('calculates Gunning Fog Index', () => {
      const score = calculateReadability('The quick brown fox jumps over the lazy dog.');
      
      expect(score.gunningFogIndex).toBeGreaterThanOrEqual(0);
    });

    it('calculates SMOG Index', () => {
      // Need at least 3 sentences for accurate SMOG
      const text = 'First sentence here. Second sentence there. Third sentence everywhere.';
      const score = calculateReadability(text);
      
      expect(score.smogIndex).toBeGreaterThanOrEqual(0);
    });

    it('Gunning Fog increases with complex words', () => {
      const simple = calculateReadability('The cat sat. The dog ran. Birds flew.');
      const complex = calculateReadability('Philosophical considerations. Epistemological frameworks. Methodological approaches.');
      
      expect(complex.gunningFogIndex).toBeGreaterThan(simple.gunningFogIndex);
    });
  });

  describe('getReadabilityDescription', () => {
    it('returns very easy for high scores', () => {
      const score = calculateReadability('I am. You are. We go.');
      const description = getReadabilityDescription(score);
      
      expect(description).toContain('easy');
    });

    it('returns difficult for low scores', () => {
      const score = {
        fleschReadingEase: 25,
        fleschKincaidGrade: 14,
        gunningFogIndex: 14,
        smogIndex: 14,
        avgWordsPerSentence: 25,
        avgSyllablesPerWord: 2.5,
        complexWordPercentage: 30,
        difficultyLevel: 'very-hard' as const,
        wpmMultiplier: 0.8,
      };
      const description = getReadabilityDescription(score);
      
      expect(description.toLowerCase()).toContain('difficult');
    });
  });

  describe('getAdjustedWPM', () => {
    it('increases WPM for easy text', () => {
      const baseWPM = 300;
      const adjustedWPM = getAdjustedWPM(baseWPM, 'The cat sat on the mat.');
      
      expect(adjustedWPM).toBeGreaterThanOrEqual(baseWPM);
    });

    it('decreases WPM for hard text', () => {
      const baseWPM = 300;
      const hardText = `Epistemological considerations regarding phenomenological 
        manifestations necessitate comprehensive methodological frameworks.`;
      const adjustedWPM = getAdjustedWPM(baseWPM, hardText);
      
      expect(adjustedWPM).toBeLessThan(baseWPM);
    });
  });

  describe('analyzeBlocks', () => {
    it('analyzes multiple blocks', () => {
      const blocks = [
        'Simple text here.',
        'Another simple block.',
        'More complex vocabulary and sentence structure utilized here.',
      ];
      
      const scores = analyzeBlocks(blocks);
      
      expect(scores).toHaveLength(3);
      expect(scores[0]).toHaveProperty('fleschReadingEase');
      expect(scores[1]).toHaveProperty('gunningFogIndex');
      expect(scores[2]).toHaveProperty('smogIndex');
    });
  });

  describe('getReadabilityReport', () => {
    it('returns formatted report', () => {
      const report = getReadabilityReport('This is a test sentence for the report.');
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('indices');
      expect(report).toHaveProperty('recommendation');
      expect(report.indices).toHaveLength(4);
      expect(report.indices[0]).toHaveProperty('name');
      expect(report.indices[0]).toHaveProperty('value');
      expect(report.indices[0]).toHaveProperty('description');
    });

    it('includes all four indices', () => {
      const report = getReadabilityReport('Test sentence.');
      const indexNames = report.indices.map(i => i.name);
      
      expect(indexNames).toContain('Flesch Reading Ease');
      expect(indexNames).toContain('Flesch-Kincaid Grade');
      expect(indexNames).toContain('Gunning Fog Index');
      expect(indexNames).toContain('SMOG Index');
    });
  });
});
