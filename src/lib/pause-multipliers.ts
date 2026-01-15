// Consolidated pause multiplier constants for consistent timing across tokenizers

import { isAbbreviation } from './abbreviations';

export const PAUSE = {
  // Sentence-ending punctuation
  SENTENCE_END: 2.0,      // . ! ?
  QUESTION: 1.8,          // ? (slightly faster than statement)
  EXCLAMATION: 2.0,       // ! (emphasis)
  ELLIPSIS: 2.5,          // ... (trailing thought)
  
  // Mid-sentence punctuation
  COMMA: 1.5,             // , ; :
  DASH: 1.3,              // - – —
  COLON: 1.6,             // : (introducing something)
  SEMICOLON: 1.7,         // ; (related clause)
  
  // Parenthetical/quotes
  CLOSE_PAREN: 1.2,       // ) ] closing parenthetical
  CLOSE_QUOTE: 1.3,       // " ' closing quote
  
  // Transition words (slight emphasis)
  TRANSITION: 1.2,        // however, therefore, etc.
  
  // Paragraph transitions
  PARAGRAPH_END: 3.0,
  
  // No pause
  NONE: 1.0,
} as const;

// Transition words/phrases that warrant a slight pause when at the start of a clause
const TRANSITION_WORDS = new Set([
  // Contrast
  'however', 'nevertheless', 'nonetheless', 'although', 'though', 'whereas',
  'conversely', 'instead', 'rather', 'yet', 'still',
  // Addition
  'furthermore', 'moreover', 'additionally', 'besides', 'also', 'likewise',
  // Cause/Effect
  'therefore', 'thus', 'hence', 'consequently', 'accordingly', 'because',
  // Example
  'specifically', 'namely', 'notably', 'particularly',
  // Sequence
  'firstly', 'secondly', 'thirdly', 'finally', 'lastly', 'meanwhile', 'subsequently',
  // Conclusion
  'ultimately', 'overall', 'essentially', 'basically',
]);

/**
 * Checks if a word is a transition word that warrants slight emphasis
 */
export function isTransitionWord(word: string): boolean {
  const cleaned = word.replace(/[,;:]/g, '').toLowerCase();
  return TRANSITION_WORDS.has(cleaned);
}

export function getPauseMultiplier(text: string): { multiplier: number; isEndOfSentence: boolean } {
  const trimmed = text.trim();
  
  // Check for ellipsis first (more specific)
  if (/\.{2,}$/.test(trimmed) || /…$/.test(trimmed)) {
    return { multiplier: PAUSE.ELLIPSIS, isEndOfSentence: true };
  }
  
  // Check for sentence-ending punctuation
  if (/[.!?]["'»]?$/.test(trimmed)) {
    // But check if it's actually an abbreviation
    if (trimmed.endsWith('.') || /\.['"»]$/.test(trimmed)) {
      const wordPart = trimmed.replace(/["'»]+$/, '');
      if (isAbbreviation(wordPart)) {
        return { multiplier: PAUSE.NONE, isEndOfSentence: false };
      }
    }
    
    if (/[?]["'»]?$/.test(trimmed)) {
      return { multiplier: PAUSE.QUESTION, isEndOfSentence: true };
    }
    if (/[!]["'»]?$/.test(trimmed)) {
      return { multiplier: PAUSE.EXCLAMATION, isEndOfSentence: true };
    }
    return { multiplier: PAUSE.SENTENCE_END, isEndOfSentence: true };
  }
  
  // Check for closing parentheses/brackets
  if (/[)\]]$/.test(trimmed)) {
    return { multiplier: PAUSE.CLOSE_PAREN, isEndOfSentence: false };
  }
  
  // Check for closing quotes
  if (/["'»]$/.test(trimmed) && !/^["'«]/.test(trimmed)) {
    return { multiplier: PAUSE.CLOSE_QUOTE, isEndOfSentence: false };
  }
  
  // Check for semicolon (stronger pause than comma)
  if (/;$/.test(trimmed)) {
    return { multiplier: PAUSE.SEMICOLON, isEndOfSentence: false };
  }
  
  // Check for colon
  if (/:$/.test(trimmed)) {
    return { multiplier: PAUSE.COLON, isEndOfSentence: false };
  }
  
  // Check for comma
  if (/,$/.test(trimmed)) {
    // Check if the word before comma is a transition word
    const wordOnly = trimmed.replace(/,$/, '');
    if (isTransitionWord(wordOnly)) {
      return { multiplier: PAUSE.COMMA + 0.2, isEndOfSentence: false }; // Slightly longer pause after transition
    }
    return { multiplier: PAUSE.COMMA, isEndOfSentence: false };
  }
  
  // Check for dashes
  if (/[-–—]$/.test(trimmed)) {
    return { multiplier: PAUSE.DASH, isEndOfSentence: false };
  }
  
  // Check if word itself is a transition word (without trailing punctuation)
  if (isTransitionWord(trimmed)) {
    return { multiplier: PAUSE.TRANSITION, isEndOfSentence: false };
  }
  
  return { multiplier: PAUSE.NONE, isEndOfSentence: false };
}

export function getSentencePauseMultiplier(sentence: string): number {
  if (/[!]/.test(sentence)) return PAUSE.EXCLAMATION;
  if (/[?]/.test(sentence)) return PAUSE.QUESTION;
  if (/\.{2,}/.test(sentence) || /…/.test(sentence)) return PAUSE.ELLIPSIS;
  return PAUSE.SENTENCE_END; // Default sentence pause
}
