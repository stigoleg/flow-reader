import { describe, it, expect } from 'vitest';
import {
  tokenizeForRSVP,
  calculateTokenDuration,
  findORP,
  getWordCount,
  countWordsForTiming,
  estimateReadingTime,
  tokenizeIntoSentences,
  tokenizeIntoWords,
  calculateSentenceDuration,
  calculateWordDuration,
  countSyllables,
  calculateWordComplexity,
} from '@/lib/tokenizer';

describe('RSVP Tokenizer', () => {
  describe('tokenizeForRSVP', () => {
    it('tokenizes simple text', () => {
      const tokens = tokenizeForRSVP('Hello world');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].text).toBe('Hello');
      expect(tokens[1].text).toBe('world');
    });

    it('detects sentence endings', () => {
      const tokens = tokenizeForRSVP('First sentence. Second sentence.');

      const sentenceEnds = tokens.filter((t) => t.isEndOfSentence);
      expect(sentenceEnds).toHaveLength(2);
    });

    it('handles paragraph breaks', () => {
      const tokens = tokenizeForRSVP('First paragraph.\n\nSecond paragraph.');

      const paragraphEnds = tokens.filter((t) => t.isEndOfParagraph);
      expect(paragraphEnds).toHaveLength(1);
    });

    it('supports chunk sizes', () => {
      const tokens1 = tokenizeForRSVP('one two three four', 1);
      const tokens2 = tokenizeForRSVP('one two three four', 2);

      expect(tokens1).toHaveLength(4);
      expect(tokens2).toHaveLength(2);
      expect(tokens2[0].text).toBe('one two');
    });

    it('applies pause multipliers for punctuation', () => {
      const tokens = tokenizeForRSVP('Hello, world. Test');

      const commaToken = tokens.find((t) => t.text.includes(','));
      const periodToken = tokens.find((t) => t.text.includes('.'));

      expect(commaToken?.pauseMultiplier).toBe(1.5);
      expect(periodToken?.pauseMultiplier).toBe(2.0);
    });
  });

  describe('calculateTokenDuration', () => {
    it('calculates base duration from WPM', () => {
      const token = { text: 'word', pauseMultiplier: 1, isEndOfSentence: false, isEndOfParagraph: false };
      const duration = calculateTokenDuration(token, 300, true);

      // 60000ms / 300wpm = 200ms
      expect(duration).toBe(200);
    });

    it('applies pause multiplier when enabled', () => {
      const token = { text: 'word.', pauseMultiplier: 2, isEndOfSentence: true, isEndOfParagraph: false };
      const duration = calculateTokenDuration(token, 300, true);

      expect(duration).toBe(400); // 200 * 2
    });

    it('ignores pause multiplier when disabled', () => {
      const token = { text: 'word.', pauseMultiplier: 2, isEndOfSentence: true, isEndOfParagraph: false };
      const duration = calculateTokenDuration(token, 300, false);

      expect(duration).toBe(200); // No multiplier
    });

    it('counts hyphenated words for timing', () => {
      const token = { text: 'large-scale', pauseMultiplier: 1, isEndOfSentence: false, isEndOfParagraph: false };
      const duration = calculateTokenDuration(token, 300, false);

      // 60000ms / 300wpm = 200ms per word, 2 hyphenated parts = 400ms
      expect(duration).toBe(400);
    });

    it('counts multi-hyphenated words for timing', () => {
      const token = { text: 'state-of-the-art', pauseMultiplier: 1, isEndOfSentence: false, isEndOfParagraph: false };
      const duration = calculateTokenDuration(token, 300, false);

      // 4 parts = 800ms
      expect(duration).toBe(800);
    });
  });

  describe('findORP', () => {
    it('returns 0 for single char', () => {
      expect(findORP('a')).toBe(0);
    });

    it('returns 1 for short words', () => {
      expect(findORP('the')).toBe(1);
      expect(findORP('hello')).toBe(1);
    });

    it('returns ~30% for longer words', () => {
      const orp = findORP('comprehension');
      expect(orp).toBeGreaterThan(1);
      expect(orp).toBeLessThan(6);
    });
  });

  describe('getWordCount', () => {
    it('counts words correctly', () => {
      expect(getWordCount('one two three')).toBe(3);
      expect(getWordCount('  spaced   words  ')).toBe(2);
      expect(getWordCount('')).toBe(0);
    });
  });

  describe('countWordsForTiming', () => {
    it('counts simple words', () => {
      expect(countWordsForTiming('one two three')).toBe(3);
      expect(countWordsForTiming('hello world')).toBe(2);
    });

    it('counts hyphenated words as multiple words', () => {
      expect(countWordsForTiming('large-scale')).toBe(2);
      expect(countWordsForTiming('self-aware')).toBe(2);
      expect(countWordsForTiming('state-of-the-art')).toBe(4);
    });

    it('handles hyphenated words in sentences', () => {
      expect(countWordsForTiming('This is a well-known fact')).toBe(6);
      expect(countWordsForTiming('The large-scale self-aware system')).toBe(6);
    });

    it('does not count dashes at start or end of words', () => {
      expect(countWordsForTiming('pre-')).toBe(1);
      expect(countWordsForTiming('-ish')).toBe(1);
      expect(countWordsForTiming('-')).toBe(1);
    });

    it('does not split numbers with hyphens', () => {
      expect(countWordsForTiming('123-456')).toBe(1);
      expect(countWordsForTiming('phone: 555-1234')).toBe(2);
    });

    it('handles Norwegian characters in hyphenated words', () => {
      expect(countWordsForTiming('før-etter')).toBe(2);
      expect(countWordsForTiming('blå-grønn')).toBe(2);
    });

    it('does not split on em-dashes or en-dashes', () => {
      // Em-dash and en-dash are not hyphens for compound words
      expect(countWordsForTiming('word—another')).toBe(1);
      expect(countWordsForTiming('word–another')).toBe(1);
    });

    it('handles empty and whitespace-only strings', () => {
      expect(countWordsForTiming('')).toBe(0);
      expect(countWordsForTiming('   ')).toBe(0);
    });
  });

  describe('estimateReadingTime', () => {
    it('calculates reading time in minutes', () => {
      const text = Array(300).fill('word').join(' '); // 300 words
      const time = estimateReadingTime(text, 300); // 300 WPM

      expect(time).toBe(1); // 1 minute
    });
  });

  describe('tokenizeIntoSentences', () => {
    it('tokenizes simple sentences', () => {
      const sentences = tokenizeIntoSentences('Hello world. This is a test.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Hello world.');
      expect(sentences[1].text).toBe('This is a test.');
    });

    it('tracks word counts correctly', () => {
      const sentences = tokenizeIntoSentences('One two three. Four five.');
      expect(sentences[0].wordCount).toBe(3);
      expect(sentences[1].wordCount).toBe(2);
    });

    it('handles question marks', () => {
      const sentences = tokenizeIntoSentences('Is this a question? Yes it is.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0].pauseMultiplier).toBe(1.8); // Question pause
      expect(sentences[1].pauseMultiplier).toBe(2.0); // Normal sentence end
    });

    it('handles exclamation marks', () => {
      const sentences = tokenizeIntoSentences('Wow! Amazing!');
      expect(sentences).toHaveLength(2);
      expect(sentences[0].pauseMultiplier).toBe(2.0);
      expect(sentences[1].pauseMultiplier).toBe(2.0);
    });

    it('handles ellipsis', () => {
      const sentences = tokenizeIntoSentences('And then... something happened.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0].pauseMultiplier).toBe(2.5); // Ellipsis pause
    });

    it('handles text without punctuation', () => {
      const sentences = tokenizeIntoSentences('No punctuation here');
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('No punctuation here');
      expect(sentences[0].pauseMultiplier).toBe(1.0);
    });

    it('tracks character indices', () => {
      const text = 'First. Second.';
      const sentences = tokenizeIntoSentences(text);
      expect(sentences[0].startIndex).toBe(0);
      expect(sentences[1].startIndex).toBe(7);
    });

    it('handles quotes after punctuation', () => {
      const sentences = tokenizeIntoSentences('"Hello." She said.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('"Hello."');
    });
  });

  describe('tokenizeIntoWords', () => {
    it('tokenizes simple text', () => {
      const words = tokenizeIntoWords('Hello world');
      expect(words).toHaveLength(2);
      expect(words[0].text).toBe('Hello');
      expect(words[1].text).toBe('world');
    });

    it('detects sentence-ending punctuation', () => {
      const words = tokenizeIntoWords('End here.');
      expect(words[1].isEndOfSentence).toBe(true);
      expect(words[1].pauseMultiplier).toBe(2.0);
    });

    it('detects comma pauses', () => {
      const words = tokenizeIntoWords('Hello, world');
      expect(words[0].pauseMultiplier).toBe(1.5);
      expect(words[0].isEndOfSentence).toBe(false);
    });

    it('detects dash pauses', () => {
      const words = tokenizeIntoWords('word— another');
      expect(words[0].pauseMultiplier).toBe(1.3);
    });

    it('tracks character indices', () => {
      const text = 'one two three';
      const words = tokenizeIntoWords(text);
      expect(words[0].startIndex).toBe(0);
      expect(words[0].endIndex).toBe(3);
      expect(words[1].startIndex).toBe(4);
      expect(words[1].endIndex).toBe(7);
      expect(words[2].startIndex).toBe(8);
      expect(words[2].endIndex).toBe(13);
    });

    it('handles multiple spaces', () => {
      const words = tokenizeIntoWords('word1   word2');
      expect(words).toHaveLength(2);
    });

    it('handles question and exclamation marks', () => {
      const words = tokenizeIntoWords('Really? Yes!');
      expect(words[0].isEndOfSentence).toBe(true);
      expect(words[1].isEndOfSentence).toBe(true);
      expect(words[0].pauseMultiplier).toBe(1.8); // PAUSE.QUESTION
      expect(words[1].pauseMultiplier).toBe(2.0); // PAUSE.EXCLAMATION
    });
  });

  describe('calculateSentenceDuration', () => {
    it('calculates base duration from WPM and word count', () => {
      const sentence = {
        text: 'Three word sentence.',
        wordCount: 3,
        startIndex: 0,
        endIndex: 20,
        pauseMultiplier: 1.5,
      };
      // At 300 WPM: 60000/300 = 200ms per word, 3 words = 600ms
      const duration = calculateSentenceDuration(sentence, 300, false);
      expect(duration).toBe(600);
    });

    it('applies pause multiplier when enabled', () => {
      const sentence = {
        text: 'Three word sentence.',
        wordCount: 3,
        startIndex: 0,
        endIndex: 20,
        pauseMultiplier: 2.0,
      };
      const duration = calculateSentenceDuration(sentence, 300, true);
      expect(duration).toBe(1200); // 600 * 2.0
    });

    it('enforces minimum duration of 300ms', () => {
      const sentence = {
        text: 'Hi.',
        wordCount: 1,
        startIndex: 0,
        endIndex: 3,
        pauseMultiplier: 1.0,
      };
      // At 600 WPM: 60000/600 = 100ms, but minimum is 300ms
      const duration = calculateSentenceDuration(sentence, 600, false);
      expect(duration).toBe(300);
    });
  });

  describe('calculateWordDuration', () => {
    it('calculates base duration from WPM', () => {
      const word = {
        text: 'word',
        startIndex: 0,
        endIndex: 4,
        pauseMultiplier: 1.0,
        isEndOfSentence: false,
      };
      // At 300 WPM: 60000/300 = 200ms
      const duration = calculateWordDuration(word, 300, false);
      expect(duration).toBe(200);
    });

    it('applies pause multiplier when enabled', () => {
      const word = {
        text: 'word.',
        startIndex: 0,
        endIndex: 5,
        pauseMultiplier: 2.0,
        isEndOfSentence: true,
      };
      const duration = calculateWordDuration(word, 300, true);
      expect(duration).toBe(400); // 200 * 2.0
    });

    it('enforces minimum duration of 80ms', () => {
      const word = {
        text: 'a',
        startIndex: 0,
        endIndex: 1,
        pauseMultiplier: 1.0,
        isEndOfSentence: false,
      };
      // At 1000 WPM: 60000/1000 = 60ms, but minimum is 80ms
      const duration = calculateWordDuration(word, 1000, false);
      expect(duration).toBe(80);
    });

    it('applies adaptive speed for simple words (faster)', () => {
      const word = {
        text: 'a',
        startIndex: 0,
        endIndex: 1,
        pauseMultiplier: 1.0,
        isEndOfSentence: false,
      };
      // At 300 WPM: base = 200ms, adaptive makes it 0.7x = 140ms
      const durationAdaptive = calculateWordDuration(word, 300, false, true);
      const durationNormal = calculateWordDuration(word, 300, false, false);
      expect(durationAdaptive).toBeLessThan(durationNormal);
      expect(durationAdaptive).toBe(140); // 200 * 0.7
    });

    it('applies adaptive speed for complex words (slower)', () => {
      const word = {
        text: 'sesquipedalian', // A rare, long word not in frequency lists
        startIndex: 0,
        endIndex: 14,
        pauseMultiplier: 1.0,
        isEndOfSentence: false,
      };
      // Complex word should take longer with adaptive
      const durationAdaptive = calculateWordDuration(word, 300, false, true);
      const durationNormal = calculateWordDuration(word, 300, false, false);
      expect(durationAdaptive).toBeGreaterThan(durationNormal);
      // Rare word (tier 5) + high complexity → multiplier ~1.3x → 260ms
      expect(durationAdaptive).toBeCloseTo(260, 0);
    });

    it('counts hyphenated words for timing', () => {
      const word = {
        text: 'large-scale',
        startIndex: 0,
        endIndex: 11,
        pauseMultiplier: 1.0,
        isEndOfSentence: false,
      };
      // At 300 WPM: 200ms per word, 2 parts = 400ms
      const duration = calculateWordDuration(word, 300, false);
      expect(duration).toBe(400);
    });

    it('counts multi-hyphenated words for timing', () => {
      const word = {
        text: 'state-of-the-art',
        startIndex: 0,
        endIndex: 16,
        pauseMultiplier: 1.0,
        isEndOfSentence: false,
      };
      // 4 parts = 800ms
      const duration = calculateWordDuration(word, 300, false);
      expect(duration).toBe(800);
    });

    it('applies pause multiplier to hyphenated words', () => {
      const word = {
        text: 'large-scale.',
        startIndex: 0,
        endIndex: 12,
        pauseMultiplier: 2.0,
        isEndOfSentence: true,
      };
      // 2 parts * 200ms * 2.0 pause = 800ms
      const duration = calculateWordDuration(word, 300, true);
      expect(duration).toBe(800);
    });
  });

  describe('countSyllables', () => {
    it('returns 1 for short words', () => {
      expect(countSyllables('a')).toBe(1);
      expect(countSyllables('the')).toBe(1);
      expect(countSyllables('on')).toBe(1);
    });

    it('counts syllables in common words', () => {
      expect(countSyllables('reading')).toBe(2);
      expect(countSyllables('beautiful')).toBe(3);
      expect(countSyllables('extraordinary')).toBe(5);
    });

    it('handles silent e', () => {
      expect(countSyllables('make')).toBe(1);
      expect(countSyllables('have')).toBe(1);
    });

    it('handles words with punctuation', () => {
      expect(countSyllables('hello,')).toBe(2);
      expect(countSyllables('world.')).toBe(1);
    });

    it('handles consonant + le endings', () => {
      expect(countSyllables('table')).toBe(2);
      expect(countSyllables('apple')).toBe(2);
    });

    it('handles -ed endings (silent after voiceless consonants)', () => {
      expect(countSyllables('walked')).toBe(1);
      expect(countSyllables('jumped')).toBe(1);
      expect(countSyllables('pushed')).toBe(1);
      expect(countSyllables('worked')).toBe(1);
    });

    it('handles -ed endings (pronounced after t/d)', () => {
      expect(countSyllables('wanted')).toBe(2);
      expect(countSyllables('needed')).toBe(2);
      expect(countSyllables('started')).toBe(2);
    });

    it('handles -es endings (silent usually)', () => {
      expect(countSyllables('makes')).toBe(1);
      expect(countSyllables('takes')).toBe(1);
      expect(countSyllables('moves')).toBe(1);
    });

    it('handles -es endings (pronounced after sibilants)', () => {
      expect(countSyllables('boxes')).toBe(2);
      expect(countSyllables('churches')).toBe(2);
      expect(countSyllables('wishes')).toBe(2);
    });

    it('uses exception dictionary for irregular words', () => {
      expect(countSyllables('queue')).toBe(1);
      expect(countSyllables('area')).toBe(3);
      expect(countSyllables('idea')).toBe(3);
      expect(countSyllables('rhythm')).toBe(2);
    });

    it('handles words where silent-e rule would over-correct', () => {
      expect(countSyllables('recipe')).toBe(3);
      expect(countSyllables('karate')).toBe(3);
    });
  });

  describe('calculateWordComplexity', () => {
    it('returns 0 for very short words', () => {
      expect(calculateWordComplexity('a')).toBe(0);
      expect(calculateWordComplexity('I')).toBe(0);
      expect(calculateWordComplexity('an')).toBe(0);
    });

    it('returns low complexity for short common words', () => {
      expect(calculateWordComplexity('the')).toBeLessThanOrEqual(0.1);
      expect(calculateWordComplexity('and')).toBeLessThanOrEqual(0.1);
    });

    it('returns medium complexity for average words', () => {
      const complexity = calculateWordComplexity('reading');
      expect(complexity).toBeGreaterThan(0.2);
      expect(complexity).toBeLessThan(0.6);
    });

    it('returns high complexity for long multi-syllable words', () => {
      const complexity = calculateWordComplexity('extraordinary');
      expect(complexity).toBeGreaterThan(0.8);
    });

    it('handles words with punctuation', () => {
      // Should strip punctuation when calculating
      const withPunct = calculateWordComplexity('hello,');
      const withoutPunct = calculateWordComplexity('hello');
      expect(withPunct).toBe(withoutPunct);
    });
  });
});
