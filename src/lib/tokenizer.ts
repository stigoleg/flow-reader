import { PAUSE, getPauseMultiplier, getSentencePauseMultiplier } from './pause-multipliers';
import { getWordSpeedMultiplier } from './word-frequency';
import { countSyllables, type SupportedLanguage } from './syllables';

export interface RSVPToken {
  text: string;
  pauseMultiplier: number;
  isEndOfSentence: boolean;
  isEndOfParagraph: boolean;
}

export interface SentenceToken {
  text: string;
  wordCount: number;
  startIndex: number;
  endIndex: number;
  pauseMultiplier: number;
}

export interface WordToken {
  text: string;
  startIndex: number;
  endIndex: number;
  pauseMultiplier: number;
  isEndOfSentence: boolean;
}

export function tokenizeForRSVP(text: string, chunkSize: number = 1): RSVPToken[] {
  const tokens: RSVPToken[] = [];
  const paragraphs = text.split(/\n\n+/);

  for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
    const paragraph = paragraphs[pIndex].trim();
    if (!paragraph) continue;

    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      const lastWord = words[Math.min(i + chunkSize - 1, words.length - 1)];
      const { multiplier, isEndOfSentence } = getPauseMultiplier(lastWord);

      const isLastChunk = i + chunkSize >= words.length;
      const isEndOfParagraph = isLastChunk && pIndex < paragraphs.length - 1;

      const pauseMultiplier = isEndOfParagraph 
        ? Math.max(multiplier, PAUSE.PARAGRAPH_END) 
        : multiplier;

      tokens.push({ text: chunk, pauseMultiplier, isEndOfSentence, isEndOfParagraph });
    }
  }

  return tokens;
}

export function calculateTokenDuration(token: RSVPToken, wpm: number, pauseOnPunctuation: boolean): number {
  const baseMs = 60000 / wpm;
  // Use countWordsForTiming to count hyphenated words as multiple words
  const wordCount = countWordsForTiming(token.text);
  let duration = baseMs * wordCount;

  if (pauseOnPunctuation) {
    duration *= token.pauseMultiplier;
  }

  return duration;
}

// ORP (Optimal Recognition Point) - where the eye naturally focuses, ~1/3 into the word
export function findORP(word: string): number {
  const cleanWord = word.replace(/[^\w]/g, '');
  if (cleanWord.length <= 1) return 0;
  if (cleanWord.length <= 5) return 1;
  return Math.floor(cleanWord.length * 0.3);
}

export function getWordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Count words for timing purposes.
 * Hyphenated words count as multiple words (e.g., "large-scale" = 2 words).
 * Only counts parts separated by hyphens between alphabetic characters.
 */
export function countWordsForTiming(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.reduce((count, word) => {
    // Count hyphen-separated parts between letters (e.g., "self-aware" → 2)
    // This regex splits on hyphens that are between letters
    const parts = word.split(/(?<=[a-zA-ZæøåÆØÅ])-(?=[a-zA-ZæøåÆØÅ])/);
    return count + Math.max(1, parts.length);
  }, 0);
}

export function estimateReadingTime(text: string, wpm: number): number {
  return getWordCount(text) / wpm;
}

export function tokenizeIntoSentences(text: string): SentenceToken[] {
  const sentences: SentenceToken[] = [];
  const sentenceRegex = /[^.!?]*[.!?]+["'»]?\s*/g;

  let match;
  let lastIndex = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence.length > 0) {
      sentences.push({
        text: sentence,
        wordCount: getWordCount(sentence),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pauseMultiplier: getSentencePauseMultiplier(sentence),
      });
      lastIndex = match.index + match[0].length;
    }
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push({
        text: remaining,
        wordCount: getWordCount(remaining),
        startIndex: lastIndex,
        endIndex: text.length,
        pauseMultiplier: PAUSE.NONE,
      });
    }
  }

  if (sentences.length === 0 && text.trim().length > 0) {
    sentences.push({
      text: text.trim(),
      wordCount: getWordCount(text),
      startIndex: 0,
      endIndex: text.length,
      pauseMultiplier: PAUSE.NONE,
    });
  }

  return sentences;
}

export function tokenizeIntoWords(text: string): WordToken[] {
  const words: WordToken[] = [];
  const wordRegex = /\S+/g;

  let match;
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const { multiplier, isEndOfSentence } = getPauseMultiplier(word);

    words.push({
      text: word,
      startIndex: match.index,
      endIndex: match.index + word.length,
      pauseMultiplier: multiplier,
      isEndOfSentence,
    });
  }

  return words;
}

export function calculateSentenceDuration(sentence: SentenceToken, wpm: number, pauseOnPunctuation: boolean): number {
  const baseMs = 60000 / wpm;
  // Use countWordsForTiming to count hyphenated words as multiple words
  let duration = baseMs * countWordsForTiming(sentence.text);

  if (pauseOnPunctuation) {
    duration *= sentence.pauseMultiplier;
  }

  return Math.max(300, duration);
}

// Re-export from syllables module
export { countSyllables, detectLanguage, countTotalSyllables, type SupportedLanguage } from './syllables';

// Complexity score: 0 = simple (short), 1 = complex (long, many syllables)
export function calculateWordComplexity(word: string, language: SupportedLanguage = 'en'): number {
  const cleanWord = word.replace(/[^a-zA-ZæøåÆØÅ]/g, '');
  const length = cleanWord.length;
  const syllables = countSyllables(word, language);

  if (length <= 2) return 0;
  if (length <= 3) return 0.1;

  const lengthFactor = Math.min(1, (length - 3) / 9);
  const syllableFactor = Math.min(1, (syllables - 1) / 3);

  return lengthFactor * 0.4 + syllableFactor * 0.6;
}

export function calculateWordDuration(
  word: WordToken,
  wpm: number,
  pauseOnPunctuation: boolean,
  adaptiveSpeed: boolean = false,
  language: SupportedLanguage = 'en'
): number {
  const baseMs = 60000 / wpm;
  
  // Count hyphenated parts for timing (e.g., "self-aware" = 2 words)
  const hyphenParts = word.text.split(/(?<=[a-zA-ZæøåÆØÅ])-(?=[a-zA-ZæøåÆØÅ])/);
  const wordMultiplier = Math.max(1, hyphenParts.length);
  
  let duration = baseMs * wordMultiplier;

  if (adaptiveSpeed) {
    // Combine structural complexity (length/syllables) with frequency-based speed
    const structuralComplexity = calculateWordComplexity(word.text, language);
    const frequencyMultiplier = getWordSpeedMultiplier(word.text, language);
    
    // Weight: 40% structural complexity, 60% frequency-based
    // Frequency multiplier already returns 0.7-1.3 range (fast for common, slow for rare)
    // Structural: convert 0-1 complexity to 0.7-1.3 multiplier
    const structuralMultiplier = 0.7 + structuralComplexity * 0.6;
    
    // Blend the two approaches for a more accurate adaptive speed
    const adaptiveMultiplier = structuralMultiplier * 0.4 + frequencyMultiplier * 0.6;
    duration *= adaptiveMultiplier;
  }

  if (pauseOnPunctuation) {
    duration *= word.pauseMultiplier;
  }

  return Math.max(80, duration);
}
