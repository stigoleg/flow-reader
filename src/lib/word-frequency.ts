/**
 * Word Complexity Module for Adaptive Speed Reading
 * 
 * This module provides language-agnostic word complexity estimation.
 * Uses heuristics based on word length and character patterns rather than
 * language-specific word lists, making it work for any language.
 * 
 * Complexity tiers:
 * 1 = very simple (short words) - read faster
 * 2 = simple - slightly faster
 * 3 = standard - normal speed
 * 4 = complex - slightly slower  
 * 5 = very complex (long words) - read slower
 */

import { countSyllables, type SupportedLanguage } from './syllables';

// Complexity tier -> speed multiplier mapping
// Lower multiplier = faster reading (simpler word)
// Higher multiplier = slower reading (complex word)
const TIER_MULTIPLIERS: Record<number, number> = {
  1: 0.7,   // Very simple words - 30% faster
  2: 0.85,  // Simple words - 15% faster
  3: 1.0,   // Standard words - normal speed
  4: 1.15,  // Complex words - 15% slower
  5: 1.3,   // Very complex words - 30% slower
};

/**
 * Estimate word complexity tier (1-5) based on language-agnostic heuristics.
 * Works for any language without requiring word lists.
 * 
 * Factors considered:
 * - Word length (primary factor)
 * - Syllable count (secondary factor)
 * 
 * @param word - The word to analyze
 * @param language - Language hint for syllable counting (defaults to 'en')
 */
export function getWordFrequencyTier(word: string, language: SupportedLanguage = 'en'): 1 | 2 | 3 | 4 | 5 {
  // Extract only letter characters (works for most scripts)
  const cleanWord = word.toLowerCase().replace(/[^a-zA-ZæøåÆØÅàáâãäåçèéêëìíîïñòóôõöùúûüýÿ\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, '');
  
  if (!cleanWord || cleanWord.length === 0) {
    return 3; // Punctuation, numbers, etc. - normal speed
  }
  
  const length = cleanWord.length;
  const syllables = countSyllables(word, language);
  
  // Length-based tier (primary factor - 70% weight)
  // These thresholds work across most languages
  let lengthTier: number;
  if (length <= 2) {
    lengthTier = 1;
  } else if (length <= 4) {
    lengthTier = 2;
  } else if (length <= 7) {
    lengthTier = 3;
  } else if (length <= 10) {
    lengthTier = 4;
  } else {
    lengthTier = 5;
  }
  
  // Syllable-based tier (secondary factor - 30% weight)
  let syllableTier: number;
  if (syllables <= 1) {
    syllableTier = 1;
  } else if (syllables <= 2) {
    syllableTier = 2;
  } else if (syllables <= 3) {
    syllableTier = 3;
  } else if (syllables <= 4) {
    syllableTier = 4;
  } else {
    syllableTier = 5;
  }
  
  // Weighted combination: 70% length, 30% syllables
  const combinedScore = lengthTier * 0.7 + syllableTier * 0.3;
  
  // Round to nearest tier
  const tier = Math.round(combinedScore);
  return Math.max(1, Math.min(5, tier)) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Get the speed multiplier for a word based on complexity.
 * Lower = faster, Higher = slower
 * 
 * @param word - The word to check
 * @param language - Language hint for syllable counting
 */
export function getWordSpeedMultiplier(word: string, language: SupportedLanguage = 'en'): number {
  const tier = getWordFrequencyTier(word, language);
  return TIER_MULTIPLIERS[tier];
}

/**
 * Check if a word is simple (low complexity).
 * 
 * @param word - The word to check
 * @param language - Language hint for syllable counting
 */
export function isCommonWord(word: string, language: SupportedLanguage = 'en'): boolean {
  const tier = getWordFrequencyTier(word, language);
  return tier <= 2;
}

/**
 * Calculate difficulty score for a word (0-1).
 * 
 * @param word - The word to check
 * @param language - Language hint for syllable counting
 */
export function getWordDifficulty(word: string, language: SupportedLanguage = 'en'): number {
  const tier = getWordFrequencyTier(word, language);
  return (tier - 1) / 4;
}
