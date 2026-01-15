/**
 * Readability scoring module using Flesch-Kincaid, Gunning Fog, SMOG, and other metrics
 * to adjust reading speed based on text difficulty.
 * 
 * Includes abbreviation-aware sentence splitting for accurate sentence counting.
 * 
 * IMPORTANT LIMITATIONS:
 * 
 * 1. English-centric formulas: Flesch-Kincaid, Gunning Fog, and SMOG indices were
 *    developed for English text. The coefficients (e.g., 206.835, 84.6 in Flesch)
 *    are calibrated for English word length, syllable patterns, and sentence
 *    structures. These formulas will produce less accurate results for Norwegian.
 * 
 * 2. Norwegian text: While syllable counting is adapted for Norwegian, the
 *    readability scores themselves may not accurately reflect difficulty levels
 *    for Norwegian content. Norwegian tends to have longer compound words,
 *    which can inflate complexity scores.
 * 
 * 3. Grade level interpretation: US grade levels (used in output) may not
 *    directly map to educational systems in other countries.
 * 
 * 4. WPM adjustments: The speed adjustments (0.8-1.15) are heuristic-based
 *    estimates, not empirically validated reading speed recommendations.
 */

import { countSyllables, detectLanguage, type SupportedLanguage } from './syllables';
import { isAbbreviation, isTitleAbbreviation } from './abbreviations';

export interface ReadabilityScore {
  fleschReadingEase: number;       // 0-100 (higher = easier)
  fleschKincaidGrade: number;      // Grade level (1-16+)
  gunningFogIndex: number;         // Grade level (complexity indicator)
  smogIndex: number;               // Grade level (medical/technical text)
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  complexWordPercentage: number;   // % of words with 3+ syllables
  difficultyLevel: 'easy' | 'medium' | 'hard' | 'very-hard';
  wpmMultiplier: number;           // Suggested speed adjustment (0.7-1.3)
  detectedLanguage?: 'en' | 'no';  // Detected language for syllable counting
}

/**
 * Split text into sentences, handling abbreviations correctly
 */
export function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  
  // Split by sentence-ending punctuation, keeping the delimiter
  const parts = text.split(/([.!?]+["'»]?\s*)/);
  
  let currentSentence = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (!part) continue;
    
    // Check if this is a delimiter (punctuation + optional quote + optional space)
    if (/^[.!?]+["'»]?\s*$/.test(part)) {
      // Check if the last word before the period is an abbreviation
      const words = currentSentence.trim().split(/\s+/);
      const lastWord = words[words.length - 1];
      
      // Look ahead to see what comes next
      const nextPart = parts[i + 1];
      
      const isAbbr = lastWord && isAbbreviation(lastWord + '.');
      
      // Determine if this should be a sentence break
      let shouldSplit = true;
      
      if (isAbbr) {
        // Single letter initial (like J. or A.) - keep with next word
        if (/^[A-Z]\.?$/.test(lastWord)) {
          shouldSplit = false;
        }
        // Title abbreviations (Dr., Mr., etc.) - keep with next word  
        else if (isTitleAbbreviation(lastWord)) {
          shouldSplit = false;
        }
        // Other abbreviations followed by lowercase - keep together
        else if (nextPart && /^[a-z]/.test(nextPart.trim())) {
          shouldSplit = false;
        }
        // Abbreviation at end of text (no next part) - it's a sentence end
        else if (!nextPart || nextPart.trim() === '') {
          shouldSplit = true;
        }
        // Non-title abbreviations (etc., vs., e.g.) followed by capital - sentence end
        else {
          shouldSplit = true;
        }
      }
      
      if (shouldSplit) {
        currentSentence += part;
        if (currentSentence.trim()) {
          sentences.push(currentSentence.trim());
        }
        currentSentence = '';
      } else {
        currentSentence += part;
      }
    } else {
      currentSentence += part;
    }
  }
  
  // Add any remaining text as a sentence
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }
  
  return sentences.filter(s => s.length > 0);
}

/**
 * Count words with 3 or more syllables (complex words)
 * Used for Gunning Fog and SMOG calculations
 */
function countComplexWords(words: string[], language: 'en' | 'no' = 'en'): number {
  return words.filter(word => {
    // Proper nouns (capitalized), compound words, and common suffixes don't count
    const cleanWord = word.replace(/[^a-zA-ZæøåÆØÅ]/g, '').toLowerCase();
    
    // Skip short words
    if (cleanWord.length < 3) return false;
    
    // Count syllables with language awareness
    const syllables = countSyllables(cleanWord, language);
    
    // Complex if 3+ syllables
    if (syllables >= 3) {
      // Exclude words that are only complex due to common suffixes
      // (some Fog implementations exclude -ed, -es, -ing endings)
      const withoutSuffix = cleanWord
        .replace(/ed$/, '')
        .replace(/es$/, '')
        .replace(/ing$/, '');
      
      // If removing suffix brings it under 3 syllables, don't count
      if (countSyllables(withoutSuffix, language) < 3) {
        return false;
      }
      
      return true;
    }
    
    return false;
  }).length;
}

/**
 * Calculate readability scores for a block of text
 * 
 * @param text - The text to analyze
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function calculateReadability(
  text: string, 
  language: SupportedLanguage = 'auto'
): ReadabilityScore {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const sentences = splitIntoSentences(text);
  
  // Detect language if auto
  const detectedLang: 'en' | 'no' = language === 'auto' ? detectLanguage(text) : language;
  
  if (words.length === 0 || sentences.length === 0) {
    return {
      fleschReadingEase: 100,
      fleschKincaidGrade: 0,
      gunningFogIndex: 0,
      smogIndex: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      complexWordPercentage: 0,
      difficultyLevel: 'easy',
      wpmMultiplier: 1.0,
      detectedLanguage: detectedLang,
    };
  }

  // Calculate totals with language-aware syllable counting
  const totalWords = words.length;
  const totalSentences = sentences.length;
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word, detectedLang), 0);
  const complexWordCount = countComplexWords(words, detectedLang);

  // Averages
  const avgWordsPerSentence = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;
  const complexWordPercentage = (complexWordCount / totalWords) * 100;

  // Flesch Reading Ease
  // Formula: 206.835 - 1.015 × (words/sentences) - 84.6 × (syllables/words)
  const fleschReadingEase = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
  ));

  // Flesch-Kincaid Grade Level
  // Formula: 0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
  const fleschKincaidGrade = Math.max(0,
    (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59
  );

  // Gunning Fog Index
  // Formula: 0.4 × [(words/sentences) + 100 × (complex words/words)]
  // Good for technical writing assessment
  const gunningFogIndex = Math.max(0,
    0.4 * (avgWordsPerSentence + complexWordPercentage)
  );

  // SMOG Index (Simple Measure of Gobbledygook)
  // Formula: 1.0430 × √(complex words × (30/sentences)) + 3.1291
  // Particularly accurate for healthcare and technical content
  const smogIndex = totalSentences >= 3
    ? Math.max(0, 1.0430 * Math.sqrt(complexWordCount * (30 / totalSentences)) + 3.1291)
    : fleschKincaidGrade; // Fall back for very short texts

  // Determine difficulty level and WPM multiplier
  // Use composite of indices for more accurate assessment
  let difficultyLevel: ReadabilityScore['difficultyLevel'];
  let wpmMultiplier: number;

  // Weight: Flesch (40%), Fog (30%), SMOG (30%)
  const compositeGrade = (fleschKincaidGrade * 0.4) + (gunningFogIndex * 0.3) + (smogIndex * 0.3);

  if (compositeGrade <= 6) {
    difficultyLevel = 'easy';
    wpmMultiplier = 1.15; // Read 15% faster
  } else if (compositeGrade <= 10) {
    difficultyLevel = 'medium';
    wpmMultiplier = 1.0; // Normal speed
  } else if (compositeGrade <= 14) {
    difficultyLevel = 'hard';
    wpmMultiplier = 0.9; // Read 10% slower
  } else {
    difficultyLevel = 'very-hard';
    wpmMultiplier = 0.8; // Read 20% slower
  }

  return {
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    gunningFogIndex: Math.round(gunningFogIndex * 10) / 10,
    smogIndex: Math.round(smogIndex * 10) / 10,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    complexWordPercentage: Math.round(complexWordPercentage * 10) / 10,
    difficultyLevel,
    wpmMultiplier,
    detectedLanguage: detectedLang,
  };
}

/**
 * Get a human-readable description of the readability score
 */
export function getReadabilityDescription(score: ReadabilityScore): string {
  const { fleschReadingEase, fleschKincaidGrade } = score;
  
  if (fleschReadingEase >= 90) return 'Very easy to read (5th grade)';
  if (fleschReadingEase >= 80) return 'Easy to read (6th grade)';
  if (fleschReadingEase >= 70) return 'Fairly easy (7th grade)';
  if (fleschReadingEase >= 60) return 'Standard (8th-9th grade)';
  if (fleschReadingEase >= 50) return 'Fairly difficult (10th-12th grade)';
  if (fleschReadingEase >= 30) return 'Difficult (College level)';
  return `Very difficult (Grade ${Math.round(fleschKincaidGrade)}+)`;
}

/**
 * Calculate an adjusted WPM based on readability
 * 
 * @param baseWPM - The base words per minute
 * @param text - The text to analyze
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function getAdjustedWPM(
  baseWPM: number, 
  text: string, 
  language: SupportedLanguage = 'auto'
): number {
  const score = calculateReadability(text, language);
  return Math.round(baseWPM * score.wpmMultiplier);
}

/**
 * Analyze an array of text blocks and return their readability scores
 * 
 * @param blocks - Array of text blocks to analyze
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function analyzeBlocks(
  blocks: string[], 
  language: SupportedLanguage = 'auto'
): ReadabilityScore[] {
  return blocks.map(block => calculateReadability(block, language));
}

/**
 * Get readability scores formatted for display
 * 
 * @param text - The text to analyze
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function getReadabilityReport(
  text: string,
  language: SupportedLanguage = 'auto'
): {
  summary: string;
  indices: { name: string; value: number; description: string }[];
  recommendation: string;
  detectedLanguage?: 'en' | 'no';
} {
  const score = calculateReadability(text, language);
  
  return {
    summary: getReadabilityDescription(score),
    indices: [
      {
        name: 'Flesch Reading Ease',
        value: score.fleschReadingEase,
        description: 'Higher is easier (0-100)',
      },
      {
        name: 'Flesch-Kincaid Grade',
        value: score.fleschKincaidGrade,
        description: 'US grade level needed',
      },
      {
        name: 'Gunning Fog Index',
        value: score.gunningFogIndex,
        description: 'Years of education needed',
      },
      {
        name: 'SMOG Index',
        value: score.smogIndex,
        description: 'Accurate for technical text',
      },
    ],
    recommendation: score.wpmMultiplier < 1
      ? `Consider reading ${Math.round((1 - score.wpmMultiplier) * 100)}% slower for better comprehension`
      : score.wpmMultiplier > 1
        ? `This text is easy - you can read ${Math.round((score.wpmMultiplier - 1) * 100)}% faster`
        : 'Normal reading speed recommended',
    detectedLanguage: score.detectedLanguage,
  };
}


