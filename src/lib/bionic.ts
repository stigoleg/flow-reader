import { getWordFrequencyTier } from './word-frequency';

export interface BionicWord {
  bold: string;
  regular: string;
}

export interface AdaptiveBionicWord extends BionicWord {
  complexityTier: 1 | 2 | 3 | 4 | 5;
}

/**
 * Convert a word to bionic format with specified bold proportion
 */
export function bionicWord(word: string, proportion: number): BionicWord {
  if (!word || word.length === 0) {
    return { bold: '', regular: '' };
  }

  let boldLength = word.length <= 3
    ? Math.max(1, Math.floor(word.length * proportion))
    : Math.max(1, Math.round(word.length * proportion));

  boldLength = Math.min(boldLength, word.length);

  return {
    bold: word.slice(0, boldLength),
    regular: word.slice(boldLength),
  };
}

/**
 * Get adaptive proportion based on word complexity
 * Simple words get less bolding (readers recognize them faster)
 * Complex words get more bolding (need more visual emphasis)
 */
function getAdaptiveProportion(word: string, baseProportion: number): number {
  const tier = getWordFrequencyTier(word);
  
  // Adjust proportion based on complexity tier
  // Tier 1 (very simple): reduce bolding by 30%
  // Tier 2 (simple): reduce bolding by 15%
  // Tier 3 (standard): use base proportion
  // Tier 4 (complex): increase bolding by 15%
  // Tier 5 (very complex): increase bolding by 30%
  const adjustments: Record<number, number> = {
    1: 0.7,  // 30% less bold
    2: 0.85, // 15% less bold
    3: 1.0,  // normal
    4: 1.15, // 15% more bold
    5: 1.3,  // 30% more bold
  };
  
  const adjustedProportion = baseProportion * adjustments[tier];
  
  // Clamp to reasonable range (0.2 to 0.6)
  return Math.max(0.2, Math.min(0.6, adjustedProportion));
}

/**
 * Convert a word to bionic format with adaptive proportion based on word complexity
 */
export function adaptiveBionicWord(word: string, baseProportion: number = 0.4): AdaptiveBionicWord {
  if (!word || word.length === 0) {
    return { bold: '', regular: '', complexityTier: 3 };
  }
  
  const complexityTier = getWordFrequencyTier(word);
  const adaptedProportion = getAdaptiveProportion(word, baseProportion);
  const result = bionicWord(word, adaptedProportion);
  
  return {
    ...result,
    complexityTier,
  };
}

/**
 * Convert text to bionic format (fixed proportion for all words)
 */
export function bionicText(text: string, proportion: number = 0.4): BionicWord[] {
  const tokens = text.match(/[\w]+|[^\w]+/g) || [];

  return tokens.map((token) => {
    if (/\w/.test(token)) {
      return bionicWord(token, proportion);
    }
    return { bold: '', regular: token };
  });
}

/**
 * Convert text to adaptive bionic format (proportion varies by word complexity)
 * Simple words get less emphasis, complex words get more
 */
export function adaptiveBionicText(text: string, baseProportion: number = 0.4): AdaptiveBionicWord[] {
  const tokens = text.match(/[\w]+|[^\w]+/g) || [];

  return tokens.map((token) => {
    if (/\w/.test(token)) {
      return adaptiveBionicWord(token, baseProportion);
    }
    return { bold: '', regular: token, complexityTier: 3 as const };
  });
}

/**
 * Calculate font weight for bionic bold portion
 */
export function bionicFontWeight(intensity: number): number {
  return Math.round(600 + intensity * 200);
}

/**
 * Get the optimal bold proportion for a given reading speed (WPM)
 * Higher speeds benefit from more bolding for visual anchoring
 */
export function getProportionForWPM(wpm: number): number {
  // Base proportion is 0.4 (40%)
  // At very high speeds (>500 WPM), increase to help with visual tracking
  // At lower speeds (<200 WPM), can reduce slightly
  if (wpm >= 600) return 0.5;
  if (wpm >= 400) return 0.45;
  if (wpm >= 200) return 0.4;
  return 0.35;
}
