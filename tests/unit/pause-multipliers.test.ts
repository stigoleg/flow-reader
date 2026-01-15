import { describe, it, expect } from 'vitest';
import {
  PAUSE,
  getPauseMultiplier,
  getSentencePauseMultiplier,
  isTransitionWord,
} from '@/lib/pause-multipliers';

describe('Pause Multipliers', () => {
  describe('PAUSE constants', () => {
    it('has correct sentence-ending values', () => {
      expect(PAUSE.SENTENCE_END).toBe(2.0);
      expect(PAUSE.QUESTION).toBe(1.8);
      expect(PAUSE.EXCLAMATION).toBe(2.0);
      expect(PAUSE.ELLIPSIS).toBe(2.5);
    });

    it('has correct mid-sentence values', () => {
      expect(PAUSE.COMMA).toBe(1.5);
      expect(PAUSE.DASH).toBe(1.3);
      expect(PAUSE.COLON).toBe(1.6);
      expect(PAUSE.SEMICOLON).toBe(1.7);
    });

    it('has correct parenthetical values', () => {
      expect(PAUSE.CLOSE_PAREN).toBe(1.2);
      expect(PAUSE.CLOSE_QUOTE).toBe(1.3);
    });

    it('has correct special values', () => {
      expect(PAUSE.TRANSITION).toBe(1.2);
      expect(PAUSE.PARAGRAPH_END).toBe(3.0);
      expect(PAUSE.NONE).toBe(1.0);
    });
  });

  describe('getPauseMultiplier', () => {
    describe('sentence-ending punctuation', () => {
      it('detects period at end of sentence', () => {
        const result = getPauseMultiplier('word.');
        expect(result.multiplier).toBe(PAUSE.SENTENCE_END);
        expect(result.isEndOfSentence).toBe(true);
      });

      it('detects question mark', () => {
        const result = getPauseMultiplier('really?');
        expect(result.multiplier).toBe(PAUSE.QUESTION);
        expect(result.isEndOfSentence).toBe(true);
      });

      it('detects exclamation mark', () => {
        const result = getPauseMultiplier('wow!');
        expect(result.multiplier).toBe(PAUSE.EXCLAMATION);
        expect(result.isEndOfSentence).toBe(true);
      });

      it('detects ellipsis (three dots)', () => {
        const result = getPauseMultiplier('trailing...');
        expect(result.multiplier).toBe(PAUSE.ELLIPSIS);
        expect(result.isEndOfSentence).toBe(true);
      });

      it('detects unicode ellipsis', () => {
        const result = getPauseMultiplier('trailing…');
        expect(result.multiplier).toBe(PAUSE.ELLIPSIS);
        expect(result.isEndOfSentence).toBe(true);
      });

      it('handles punctuation with closing quotes', () => {
        const result = getPauseMultiplier('word."');
        expect(result.multiplier).toBe(PAUSE.SENTENCE_END);
        expect(result.isEndOfSentence).toBe(true);
      });

      it('handles question mark with closing quote', () => {
        const result = getPauseMultiplier('really?"');
        expect(result.multiplier).toBe(PAUSE.QUESTION);
        expect(result.isEndOfSentence).toBe(true);
      });
    });

    describe('abbreviation detection', () => {
      it('recognizes title abbreviations (Mr.)', () => {
        const result = getPauseMultiplier('Mr.');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('recognizes title abbreviations (Dr.)', () => {
        const result = getPauseMultiplier('Dr.');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('recognizes common abbreviations (etc.)', () => {
        const result = getPauseMultiplier('etc.');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('recognizes common abbreviations (vs.)', () => {
        const result = getPauseMultiplier('vs.');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('recognizes single letter initials (J.)', () => {
        const result = getPauseMultiplier('J.');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('recognizes month abbreviations (Jan.)', () => {
        const result = getPauseMultiplier('Jan.');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('does not treat regular words ending in period as abbreviations', () => {
        const result = getPauseMultiplier('sentence.');
        expect(result.multiplier).toBe(PAUSE.SENTENCE_END);
        expect(result.isEndOfSentence).toBe(true);
      });
    });

    describe('mid-sentence punctuation', () => {
      it('detects comma', () => {
        const result = getPauseMultiplier('word,');
        expect(result.multiplier).toBe(PAUSE.COMMA);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects semicolon', () => {
        const result = getPauseMultiplier('clause;');
        expect(result.multiplier).toBe(PAUSE.SEMICOLON);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects colon', () => {
        const result = getPauseMultiplier('introducing:');
        expect(result.multiplier).toBe(PAUSE.COLON);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects dash', () => {
        const result = getPauseMultiplier('word—');
        expect(result.multiplier).toBe(PAUSE.DASH);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects en-dash', () => {
        const result = getPauseMultiplier('word–');
        expect(result.multiplier).toBe(PAUSE.DASH);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects hyphen at end', () => {
        const result = getPauseMultiplier('word-');
        expect(result.multiplier).toBe(PAUSE.DASH);
        expect(result.isEndOfSentence).toBe(false);
      });
    });

    describe('parenthetical/quote closings', () => {
      it('detects closing parenthesis', () => {
        const result = getPauseMultiplier('aside)');
        expect(result.multiplier).toBe(PAUSE.CLOSE_PAREN);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects closing bracket', () => {
        const result = getPauseMultiplier('note]');
        expect(result.multiplier).toBe(PAUSE.CLOSE_PAREN);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('detects closing quote (not opening)', () => {
        const result = getPauseMultiplier('word"');
        expect(result.multiplier).toBe(PAUSE.CLOSE_QUOTE);
        expect(result.isEndOfSentence).toBe(false);
      });
    });

    describe('transition words', () => {
      it('applies transition pause to transition words', () => {
        const result = getPauseMultiplier('however');
        expect(result.multiplier).toBe(PAUSE.TRANSITION);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('applies extra pause to transition word with comma', () => {
        const result = getPauseMultiplier('however,');
        expect(result.multiplier).toBe(PAUSE.COMMA + 0.2);
        expect(result.isEndOfSentence).toBe(false);
      });
    });

    describe('no pause cases', () => {
      it('returns NONE for regular word', () => {
        const result = getPauseMultiplier('word');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });

      it('handles whitespace', () => {
        const result = getPauseMultiplier('  word  ');
        expect(result.multiplier).toBe(PAUSE.NONE);
        expect(result.isEndOfSentence).toBe(false);
      });
    });
  });

  describe('isTransitionWord', () => {
    it('identifies contrast words', () => {
      expect(isTransitionWord('however')).toBe(true);
      expect(isTransitionWord('nevertheless')).toBe(true);
      expect(isTransitionWord('although')).toBe(true);
    });

    it('identifies addition words', () => {
      expect(isTransitionWord('furthermore')).toBe(true);
      expect(isTransitionWord('moreover')).toBe(true);
      expect(isTransitionWord('additionally')).toBe(true);
    });

    it('identifies cause/effect words', () => {
      expect(isTransitionWord('therefore')).toBe(true);
      expect(isTransitionWord('consequently')).toBe(true);
      expect(isTransitionWord('thus')).toBe(true);
    });

    it('identifies sequence words', () => {
      expect(isTransitionWord('firstly')).toBe(true);
      expect(isTransitionWord('finally')).toBe(true);
      expect(isTransitionWord('meanwhile')).toBe(true);
    });

    it('handles case insensitivity', () => {
      expect(isTransitionWord('HOWEVER')).toBe(true);
      expect(isTransitionWord('Therefore')).toBe(true);
    });

    it('strips trailing punctuation', () => {
      expect(isTransitionWord('however,')).toBe(true);
      expect(isTransitionWord('therefore;')).toBe(true);
    });

    it('returns false for non-transition words', () => {
      expect(isTransitionWord('the')).toBe(false);
      expect(isTransitionWord('running')).toBe(false);
      expect(isTransitionWord('quickly')).toBe(false);
    });
  });

  describe('getSentencePauseMultiplier', () => {
    it('returns EXCLAMATION for sentences with !', () => {
      expect(getSentencePauseMultiplier('What a day!')).toBe(PAUSE.EXCLAMATION);
    });

    it('returns QUESTION for sentences with ?', () => {
      expect(getSentencePauseMultiplier('Is this right?')).toBe(PAUSE.QUESTION);
    });

    it('returns ELLIPSIS for sentences with ...', () => {
      expect(getSentencePauseMultiplier('And then...')).toBe(PAUSE.ELLIPSIS);
    });

    it('returns ELLIPSIS for sentences with unicode ellipsis', () => {
      expect(getSentencePauseMultiplier('And then…')).toBe(PAUSE.ELLIPSIS);
    });

    it('returns SENTENCE_END (default) for regular sentences', () => {
      expect(getSentencePauseMultiplier('This is a sentence.')).toBe(PAUSE.SENTENCE_END);
    });

    it('prioritizes ! over ? when both present', () => {
      // Tests order of checks - ! is checked first
      expect(getSentencePauseMultiplier('Really?!')).toBe(PAUSE.EXCLAMATION);
    });
  });
});
